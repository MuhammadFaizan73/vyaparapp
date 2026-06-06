import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PingLocationDto, CheckInDto, CheckOutDto, ShopCheckInDto } from "./location.dto";

const CHECK_IN_RADIUS_M = 120;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async ping(tenantId: string, memberId: string, dto: PingLocationDto) {
    await this.prisma.locationPing.create({
      data: {
        tenantId,
        memberId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
      },
    });
    return { ok: true };
  }

  async getOfficeLocation(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return {
      lat: tenant?.officeLat ?? null,
      lng: tenant?.officeLng ?? null,
      label: tenant?.officeLabel ?? null,
    };
  }

  async setOfficeLocation(tenantId: string, lat: number, lng: number, label?: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { officeLat: lat, officeLng: lng, officeLabel: label ?? null },
    });
    return { ok: true };
  }

  async checkIn(tenantId: string, memberId: string, dto: CheckInDto) {
    const open = await this.prisma.shopVisit.findFirst({
      where: { memberId, checkedOutAt: null },
    });
    if (open) {
      throw new BadRequestException("Already checked in. Check out first.");
    }

    // Validate salesman is within CHECK_IN_RADIUS_M of the office location
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant?.officeLat != null && tenant?.officeLng != null) {
      const dist = haversineMeters(dto.latitude, dto.longitude, tenant.officeLat, tenant.officeLng);
      if (dist > CHECK_IN_RADIUS_M) {
        throw new BadRequestException(
          `You are ${Math.round(dist)} m away from the office. Move within ${CHECK_IN_RADIUS_M} m to check in.`
        );
      }
    }

    // Geo-fence validation: salesman must be within CHECK_IN_RADIUS_M of the party's saved location
    if (dto.partyId) {
      const party = await this.prisma.party.findUnique({ where: { id: dto.partyId } });
      if (party && party.latitude != null && party.longitude != null) {
        const dist = haversineMeters(dto.latitude, dto.longitude, party.latitude, party.longitude);
        if (dist > CHECK_IN_RADIUS_M) {
          throw new BadRequestException(
            `You are ${Math.round(dist)} m away from ${party.name}. Move within ${CHECK_IN_RADIUS_M} m to check in.`
          );
        }
      }
    }

    const visit = await this.prisma.shopVisit.create({
      data: {
        tenantId,
        memberId,
        partyId: dto.partyId ?? null,
        partyName: dto.partyName ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        notes: dto.notes ?? null,
      },
    });
    return visit;
  }

  async checkOut(tenantId: string, memberId: string, visitId: string, dto: CheckOutDto) {
    const visit = await this.prisma.shopVisit.findUnique({ where: { id: visitId } });
    if (!visit || visit.tenantId !== tenantId) throw new NotFoundException("Visit not found");
    if (visit.memberId !== memberId) throw new ForbiddenException();
    if (visit.checkedOutAt) throw new BadRequestException("Already checked out");

    const now = new Date();
    const durationMin = Math.round((now.getTime() - visit.checkedInAt.getTime()) / 60000);
    return this.prisma.shopVisit.update({
      where: { id: visitId },
      data: {
        checkedOutAt: now,
        durationMin,
        notes: dto.notes ?? visit.notes,
      },
    });
  }

  async getMyVisits(tenantId: string, memberId: string) {
    return this.prisma.shopVisit.findMany({
      where: { tenantId, memberId },
      orderBy: { checkedInAt: "desc" },
      take: 50,
    });
  }

  async getLiveLocations(tenantId: string) {
    const members = await this.prisma.teamMember.findMany({
      where: { tenantId, status: "active" },
      select: { id: true, name: true, contact: true, role: true },
    });

    const results = await Promise.all(
      members.map(async (m) => {
        const latest = await this.prisma.locationPing.findFirst({
          where: { memberId: m.id },
          orderBy: { createdAt: "desc" },
        });
        const openVisit = await this.prisma.shopVisit.findFirst({
          where: { memberId: m.id, checkedOutAt: null },
          orderBy: { checkedInAt: "desc" },
        });
        return {
          member: m,
          lastSeen: latest?.createdAt ?? null,
          latitude: latest?.latitude ?? null,
          longitude: latest?.longitude ?? null,
          currentVisit: openVisit ?? null,
        };
      }),
    );
    return results;
  }

  async getMemberVisits(tenantId: string, memberId: string, from?: string, to?: string) {
    const where: any = { tenantId, memberId };
    if (from || to) {
      where.checkedInAt = {};
      if (from) where.checkedInAt.gte = new Date(from);
      if (to) where.checkedInAt.lte = new Date(to);
    }
    return this.prisma.shopVisit.findMany({
      where,
      orderBy: { checkedInAt: "desc" },
    });
  }

  private async hasOfficeCheckInToday(memberId: string): Promise<boolean> {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const visit = await this.prisma.shopVisit.findFirst({
      where: { memberId, partyId: null, checkedInAt: { gte: start, lte: end } },
    });
    return visit != null;
  }

  async getOfficeCheckInToday(tenantId: string, memberId: string) {
    const checkedIn = await this.hasOfficeCheckInToday(memberId);
    return { checkedIn };
  }

  async shopCheckIn(tenantId: string, memberId: string, dto: ShopCheckInDto) {
    // Enforce office check-in before any shop visit
    const officeIn = await this.hasOfficeCheckInToday(memberId);
    if (!officeIn) {
      throw new BadRequestException("You must check in at the office before visiting shops.");
    }

    // Block if there's already an open shop visit
    const openShop = await this.prisma.shopVisit.findFirst({
      where: { memberId, checkedOutAt: null, NOT: { partyId: null } },
    });
    if (openShop) {
      throw new BadRequestException("Already checked in at a shop. Check out first.");
    }

    // Geo-fence: if party has location, must be within 120 m
    const party = await this.prisma.party.findUnique({ where: { id: dto.partyId } });
    if (party?.latitude != null && party?.longitude != null) {
      const dist = haversineMeters(dto.latitude, dto.longitude, party.latitude, party.longitude);
      if (dist > CHECK_IN_RADIUS_M) {
        throw new BadRequestException(
          `You are ${Math.round(dist)} m away from ${party.name}. Move within ${CHECK_IN_RADIUS_M} m to check in.`
        );
      }
    }

    return this.prisma.shopVisit.create({
      data: { tenantId, memberId, partyId: dto.partyId, partyName: dto.partyName, latitude: dto.latitude, longitude: dto.longitude, notes: dto.notes ?? null },
    });
  }

  async getMyRoute(tenantId: string, memberId: string) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return this.prisma.shopVisit.findMany({
      where: { tenantId, memberId, NOT: { partyId: null }, checkedInAt: { gte: start, lte: end } },
      orderBy: { checkedInAt: "asc" },
    });
  }

  async getAdminMemberRoute(tenantId: string, memberId: string, date: string) {
    const d = new Date(date);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    return this.prisma.shopVisit.findMany({
      where: { tenantId, memberId, NOT: { partyId: null }, checkedInAt: { gte: start, lte: end } },
      orderBy: { checkedInAt: "asc" },
    });
  }

  async getMemberPingsForDate(tenantId: string, memberId: string, date: string) {
    const d = new Date(date);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    return this.prisma.locationPing.findMany({
      where: { tenantId, memberId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "asc" },
      select: { latitude: true, longitude: true, createdAt: true },
    });
  }
}
