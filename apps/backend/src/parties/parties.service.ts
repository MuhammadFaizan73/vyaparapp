import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePartyDto, UpdatePartyDto } from "./parties.dto";

export type PartyRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  billingAddress: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  openingBalance: number;
  creditLimit: number | null;
  creditDays: number | null;
  gstin: string | null;
  pan: string | null;
  ntn: string | null;
  cnic: string | null;
  strn: string | null;
  partyType: string;
  isSystem: boolean;
  groupId: string | null;
  groupName: string | null;
  balance: number;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

function toRow(p: any): PartyRow {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email,
    billingAddress: p.billingAddress,
    city: p.city,
    state: p.state,
    pincode: p.pincode,
    shippingAddress: p.shippingAddress,
    shippingCity: p.shippingCity,
    shippingState: p.shippingState,
    shippingPincode: p.shippingPincode,
    openingBalance: p.openingBalance ?? 0,
    creditLimit: p.creditLimit,
    creditDays: p.creditDays,
    gstin: p.gstin,
    pan: p.pan,
    ntn: p.ntn,
    cnic: p.cnic,
    strn: p.strn,
    partyType: p.partyType ?? "both",
    isSystem: p.isSystem,
    groupId: p.groupId ?? null,
    groupName: p.group?.name ?? null,
    balance: p.openingBalance ?? 0,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<PartyRow[]> {
    const parties = await this.prisma.party.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      include: { transactions: { select: { total: true } }, group: true },
    });
    return parties.map((p) => {
      const txnSum = (p.transactions ?? []).reduce((s: number, t: { total: number }) => s + t.total, 0);
      return { ...toRow(p), balance: (p.openingBalance ?? 0) + txnSum };
    });
  }

  async create(tenantId: string, dto: CreatePartyDto): Promise<PartyRow> {
    const party = await this.prisma.party.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        billingAddress: dto.billingAddress ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        pincode: dto.pincode ?? null,
        shippingAddress: dto.shippingAddress ?? null,
        shippingCity: dto.shippingCity ?? null,
        shippingState: dto.shippingState ?? null,
        shippingPincode: dto.shippingPincode ?? null,
        openingBalance: dto.openingBalance ?? 0,
        creditLimit: dto.creditLimit ?? null,
        creditDays: dto.creditDays ?? null,
        gstin: dto.gstin ?? null,
        pan: dto.pan ?? null,
        ntn: dto.ntn ?? null,
        cnic: dto.cnic ?? null,
        strn: dto.strn ?? null,
        partyType: dto.partyType ?? "both",
        groupId: dto.groupId ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      },
    });
    return toRow(party);
  }

  async update(tenantId: string, id: string, dto: UpdatePartyDto): Promise<PartyRow> {
    const existing = await this.prisma.party.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Party not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    if (existing.isSystem) throw new ForbiddenException("Cannot edit system parties");

    const party = await this.prisma.party.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone || null }),
        ...(dto.email !== undefined && { email: dto.email || null }),
        ...(dto.billingAddress !== undefined && { billingAddress: dto.billingAddress || null }),
        ...(dto.city !== undefined && { city: dto.city || null }),
        ...(dto.state !== undefined && { state: dto.state || null }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode || null }),
        ...(dto.shippingAddress !== undefined && { shippingAddress: dto.shippingAddress || null }),
        ...(dto.shippingCity !== undefined && { shippingCity: dto.shippingCity || null }),
        ...(dto.shippingState !== undefined && { shippingState: dto.shippingState || null }),
        ...(dto.shippingPincode !== undefined && { shippingPincode: dto.shippingPincode || null }),
        ...(dto.openingBalance !== undefined && { openingBalance: dto.openingBalance }),
        ...(dto.creditLimit !== undefined && { creditLimit: dto.creditLimit }),
        ...(dto.creditDays !== undefined && { creditDays: dto.creditDays }),
        ...(dto.gstin !== undefined && { gstin: dto.gstin || null }),
        ...(dto.pan !== undefined && { pan: dto.pan || null }),
        ...(dto.ntn !== undefined && { ntn: dto.ntn || null }),
        ...(dto.cnic !== undefined && { cnic: dto.cnic || null }),
        ...(dto.strn !== undefined && { strn: dto.strn || null }),
        ...(dto.partyType !== undefined && { partyType: dto.partyType }),
        ...(dto.groupId !== undefined && { groupId: dto.groupId || null }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude ?? null }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude ?? null }),
      },
    });
    return toRow(party);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.party.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Party not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    if (existing.isSystem) throw new ForbiddenException("Cannot delete system parties");
    await this.prisma.party.delete({ where: { id } });
  }

  async seedSystemParties(tenantId: string): Promise<void> {
    const existing = await this.prisma.party.findFirst({
      where: { tenantId, isSystem: true },
    });
    if (existing) return;
    await this.prisma.party.create({
      data: { tenantId, name: "Cash Sale", isSystem: true },
    });
  }
}
