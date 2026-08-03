import { Injectable, NotFoundException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDistributorDto, UpdateDistributorDto } from "./distributors.dto";

export type DistributorRow = {
  id: string;
  name: string;
  businessType: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

function toRow(d: any): DistributorRow {
  return {
    id: d.id,
    name: d.name,
    businessType: d.businessType,
    email: d.email,
    phone: d.phone,
    createdAt: d.createdAt.toISOString(),
  };
}

@Injectable()
export class DistributorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<DistributorRow[]> {
    const distributors = await this.prisma.distributor.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    return distributors.map(toRow);
  }

  async create(tenantId: string, dto: CreateDistributorDto): Promise<DistributorRow> {
    const distributor = await this.prisma.distributor.create({
      data: {
        tenantId,
        name: dto.name,
        businessType: dto.businessType ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
      },
    });
    return toRow(distributor);
  }

  async update(tenantId: string, id: string, dto: UpdateDistributorDto): Promise<DistributorRow> {
    const existing = await this.prisma.distributor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Distributor not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();

    const distributor = await this.prisma.distributor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.businessType !== undefined && { businessType: dto.businessType || null }),
        ...(dto.email !== undefined && { email: dto.email || null }),
        ...(dto.phone !== undefined && { phone: dto.phone || null }),
      },
    });
    return toRow(distributor);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.distributor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Distributor not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    const branchCount = await this.prisma.branch.count({ where: { distributorId: id } });
    if (branchCount > 0) {
      throw new ConflictException("Delete or reassign this distributor's branches first");
    }
    await this.prisma.distributor.delete({ where: { id } });
  }
}
