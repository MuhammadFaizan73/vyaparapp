import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCompanyDto, UpdateCompanyDto } from "./companies.dto";

export type CompanyRow = {
  id: string;
  name: string;
  businessType: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  createdAt: string;
};

function toRow(c: any): CompanyRow {
  return {
    id: c.id,
    name: c.name,
    businessType: c.businessType,
    email: c.email,
    phone: c.phone,
    gstin: c.gstin,
    createdAt: c.createdAt.toISOString(),
  };
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  // One-time, best-effort import of the legacy Tenant.extraCompanies JSON blob
  // (mobile's whole-array-replace flow) into real Company rows, so a tenant that
  // only ever used mobile doesn't lose their companies when desktop switches over.
  private async ensureMigratedFromLegacyBlob(tenantId: string): Promise<void> {
    const existing = await this.prisma.company.count({ where: { tenantId } });
    if (existing > 0) return;

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;

    let legacy: Array<{ name?: string; businessType?: string; email?: string; phone?: string; gstin?: string }> = [];
    try {
      legacy = JSON.parse(tenant.extraCompanies || "[]");
    } catch {
      legacy = [];
    }
    if (!Array.isArray(legacy) || legacy.length === 0) return;

    await this.prisma.company.createMany({
      data: legacy
        .filter((c) => c && c.name)
        .map((c) => ({
          tenantId,
          name: c.name!,
          businessType: c.businessType ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          gstin: c.gstin ?? null,
        })),
    });
  }

  async list(tenantId: string): Promise<CompanyRow[]> {
    await this.ensureMigratedFromLegacyBlob(tenantId);
    const companies = await this.prisma.company.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    return companies.map(toRow);
  }

  async create(tenantId: string, dto: CreateCompanyDto): Promise<CompanyRow> {
    const company = await this.prisma.company.create({
      data: {
        tenantId,
        name: dto.name,
        businessType: dto.businessType ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        gstin: dto.gstin ?? null,
      },
    });
    return toRow(company);
  }

  async update(tenantId: string, id: string, dto: UpdateCompanyDto): Promise<CompanyRow> {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Company not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();

    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.businessType !== undefined && { businessType: dto.businessType || null }),
        ...(dto.email !== undefined && { email: dto.email || null }),
        ...(dto.phone !== undefined && { phone: dto.phone || null }),
        ...(dto.gstin !== undefined && { gstin: dto.gstin || null }),
      },
    });
    return toRow(company);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Company not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    await this.prisma.company.delete({ where: { id } });
  }
}
