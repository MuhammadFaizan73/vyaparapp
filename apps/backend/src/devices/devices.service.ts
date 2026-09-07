import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDeviceDto } from "./devices.dto";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  // memberId is "" for the tenant owner's own login, or a TeamMember.id for a staff
  // login (see JwtGuard/AuthedRequest.memberId) — every lookup below is scoped to it so
  // an owner logging in and a staff member logging in never kick each other's session;
  // each identity gets its own single-device slot AND its own isActive read/write lock.
  // The isActive lock was originally tenant-wide (only one device across the WHOLE
  // tenant could be active at a time) — that's what still left a second, different
  // person stuck read-only after this file's memberId scoping had already stopped them
  // from deleting each other's sessions outright. Scoped by memberId here too so an
  // owner and a staff member (or two different staff members) can each hold their own
  // active device simultaneously.
  async register(tenantId: string, memberId: string, dto: RegisterDeviceDto) {
    // Mobile and desktop are sold as separate single-device licenses — logging in on a
    // new phone/PC kicks any other device of that SAME type off immediately (removed
    // here; the old device's poll loop — useDeviceSession.tsx on mobile, Shell.tsx's
    // registerDevice interval on desktop — notices its session is gone and force-logs-
    // out within ~30s). The two license types are independent: a new mobile login never
    // touches a desktop session or vice versa. "web" isn't a sold license yet, so it
    // still only participates in the older multi-device "view-only" read/write lock
    // via `isActive`, shared with whichever type happens to hold it.
    if (dto.deviceType === "mobile" || dto.deviceType === "desktop") {
      const otherSameType = await this.prisma.deviceSession.findMany({
        where: { tenantId, memberId, deviceType: dto.deviceType, deviceId: { not: dto.deviceId } },
      });
      for (const s of otherSameType) {
        await this.remove(tenantId, s.id);
      }
    }

    const session = await this.prisma.deviceSession.upsert({
      where: { tenantId_memberId_deviceId: { tenantId, memberId, deviceId: dto.deviceId } },
      update: { deviceName: dto.deviceName, deviceType: dto.deviceType, lastSeenAt: new Date() },
      create: {
        tenantId,
        memberId,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        deviceType: dto.deviceType,
        isActive: false,
      },
    });

    // Auto-activate if this is the only / first active device for THIS identity
    const activeCount = await this.prisma.deviceSession.count({
      where: { tenantId, memberId, isActive: true },
    });
    if (activeCount === 0) {
      await this.prisma.deviceSession.update({
        where: { id: session.id },
        data: { isActive: true },
      });
      return { ...session, isActive: true };
    }

    // Return current isActive status for this session
    const updated = await this.prisma.deviceSession.findUnique({ where: { id: session.id } });
    return updated!;
  }

  async list(tenantId: string) {
    return this.prisma.deviceSession.findMany({
      where: { tenantId },
      orderBy: { lastSeenAt: "desc" },
    });
  }

  async activate(tenantId: string, sessionId: string) {
    const session = await this.prisma.deviceSession.findUnique({ where: { id: sessionId } });
    if (!session || session.tenantId !== tenantId) {
      throw new NotFoundException("Device session not found");
    }
    // Deactivate this identity's other devices, then activate the chosen one — scoped by
    // the session's own memberId so activating your device never touches another
    // identity's active slot.
    await this.prisma.deviceSession.updateMany({ where: { tenantId, memberId: session.memberId }, data: { isActive: false } });
    return this.prisma.deviceSession.update({ where: { id: sessionId }, data: { isActive: true } });
  }

  async remove(tenantId: string, sessionId: string) {
    const session = await this.prisma.deviceSession.findUnique({ where: { id: sessionId } });
    if (!session || session.tenantId !== tenantId) {
      throw new NotFoundException("Device session not found");
    }
    await this.prisma.deviceSession.delete({ where: { id: sessionId } });

    // If we deleted the active device, auto-activate this same identity's most recently
    // seen remaining device — not just any device tenant-wide, which would hand another
    // person's session the promotion.
    if (session.isActive) {
      const next = await this.prisma.deviceSession.findFirst({
        where: { tenantId, memberId: session.memberId },
        orderBy: { lastSeenAt: "desc" },
      });
      if (next) {
        await this.prisma.deviceSession.update({ where: { id: next.id }, data: { isActive: true } });
      }
    }
  }
}
