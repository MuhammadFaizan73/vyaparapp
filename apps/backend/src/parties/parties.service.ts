import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePartyDto } from "./parties.dto";

export type PartyRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  billingAddress: string | null;
  isSystem: boolean;
  balance: number;
  createdAt: string;
};

@Injectable()
export class PartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<PartyRow[]> {
    const parties = await this.prisma.party.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    return parties.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      billingAddress: p.billingAddress,
      isSystem: p.isSystem,
      balance: 0,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async create(tenantId: string, dto: CreatePartyDto): Promise<PartyRow> {
    const party = await this.prisma.party.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        billingAddress: dto.billingAddress ?? null,
      },
    });
    return {
      id: party.id,
      name: party.name,
      phone: party.phone,
      email: party.email,
      billingAddress: party.billingAddress,
      isSystem: party.isSystem,
      balance: 0,
      createdAt: party.createdAt.toISOString(),
    };
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
