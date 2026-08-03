import { Injectable, NotFoundException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBranchDto, UpdateBranchDto } from "./branches.dto";

export type BranchRow = {
  id: string;
  distributorId: string;
  name: string;
  city: string | null;
  createdAt: string;
};

function toRow(b: any): BranchRow {
  return {
    id: b.id,
    distributorId: b.distributorId,
    name: b.name,
    city: b.city,
    createdAt: b.createdAt.toISOString(),
  };
}

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, distributorId?: string): Promise<BranchRow[]> {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId, ...(distributorId ? { distributorId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return branches.map(toRow);
  }

  private async assertDistributorOwned(tenantId: string, distributorId: string) {
    const distributor = await this.prisma.distributor.findUnique({ where: { id: distributorId } });
    if (!distributor || distributor.tenantId !== tenantId) {
      throw new NotFoundException("Distributor not found");
    }
  }

  async create(tenantId: string, dto: CreateBranchDto): Promise<BranchRow> {
    await this.assertDistributorOwned(tenantId, dto.distributorId);
    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        distributorId: dto.distributorId,
        name: dto.name,
        city: dto.city ?? null,
      },
    });
    return toRow(branch);
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto): Promise<BranchRow> {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Branch not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    if (dto.distributorId !== undefined) {
      await this.assertDistributorOwned(tenantId, dto.distributorId);
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.distributorId !== undefined && { distributorId: dto.distributorId }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.city !== undefined && { city: dto.city || null }),
      },
    });
    return toRow(branch);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Branch not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    const companyCount = await this.prisma.company.count({ where: { branchId: id } });
    if (companyCount > 0) {
      throw new ConflictException("Reassign or delete this branch's companies first");
    }
    await this.prisma.branch.delete({ where: { id } });
  }
}
