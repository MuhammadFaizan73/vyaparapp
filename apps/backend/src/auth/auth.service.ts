import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto, UpdateTenantDto } from "./auth.dto";

const TRIAL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Strip the national trunk prefix ("0" in "03328286016") before combining with the
    // country code — otherwise "+92" + "03328286016" produces "+9203328286016", a phone
    // number that will never match how anyone actually re-enters the same number, silently
    // creating a brand new, unlicensed tenant instead of matching the existing one.
    const localNumber = dto.phone.replace(/^0+/, "");
    const fullPhone = `${dto.countryCode}${localNumber}`;

    let tenant = await this.prisma.tenant.findUnique({
      where: { phone: fullPhone },
    });

    const isNew = !tenant;
    if (!tenant) {
      const now = new Date();
      const expires = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      tenant = await this.prisma.tenant.create({
        data: {
          phone: fullPhone,
          countryCode: dto.countryCode,
          trialStartedAt: now,
          trialExpiresAt: expires,
        },
      });
    }

    if (isNew) {
      await this.prisma.party.create({
        data: { tenantId: tenant.id, name: "Cash Sale", isSystem: true },
      });
    }

    const token = await this.jwt.signAsync({ sub: tenant.id });
    return {
      token,
      tenant: {
        id: tenant.id,
        phone: tenant.phone,
        countryCode: tenant.countryCode,
        trialStartedAt: tenant.trialStartedAt.toISOString(),
        trialExpiresAt: tenant.trialExpiresAt.toISOString(),
      },
    };
  }

  // `Company` rows are now the source of truth for a tenant's company list; the raw
  // `Tenant.extraCompanies` JSON column is kept in sync as a compatibility shim so
  // mobile's existing whole-array-replace flow (create-company.tsx/manage-companies.tsx)
  // keeps working unchanged. This lazily imports any companies that only ever existed
  // in the old blob (e.g. a tenant that's only used mobile so far) into real rows.
  private async ensureCompaniesMigrated(tenantId: string, rawExtraCompanies: string): Promise<void> {
    const existing = await this.prisma.company.count({ where: { tenantId } });
    if (existing > 0) return;

    let legacy: Array<{ name?: string; businessType?: string; email?: string; phone?: string; gstin?: string }> = [];
    try {
      legacy = JSON.parse(rawExtraCompanies || "[]");
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

  private async companiesAsExtraCompanies(tenantId: string) {
    const companies = await this.prisma.company.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      businessType: c.businessType ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      gstin: c.gstin ?? "",
    }));
  }

  async getTenant(tenantId: string) {
    const t = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true, phone: true, countryCode: true,
        companyName: true, businessType: true, companyEmail: true,
        extraCompanies: true,
        trialStartedAt: true, trialExpiresAt: true,
      },
    });
    await this.ensureCompaniesMigrated(tenantId, t.extraCompanies);
    return {
      ...t,
      extraCompanies: await this.companiesAsExtraCompanies(tenantId),
    };
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
    if (dto.extraCompanies !== undefined) {
      await this.syncCompaniesFromBlob(tenantId, dto.extraCompanies);
    }

    const t = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.businessType !== undefined && { businessType: dto.businessType }),
        ...(dto.companyEmail !== undefined && { companyEmail: dto.companyEmail }),
        ...(dto.extraCompanies !== undefined && { extraCompanies: dto.extraCompanies }),
      },
      select: {
        id: true, phone: true, countryCode: true,
        companyName: true, businessType: true, companyEmail: true,
        extraCompanies: true,
      },
    });
    return {
      ...t,
      extraCompanies: await this.companiesAsExtraCompanies(tenantId),
    };
  }

  // Mobile always sends the whole company array on every save (no per-item CRUD) — mirror
  // that same replace-the-whole-set semantics into the real Company table: update rows whose
  // id we recognize, create the rest, delete any row that's no longer present in the array.
  private async syncCompaniesFromBlob(tenantId: string, rawExtraCompanies: string): Promise<void> {
    let incoming: Array<{ id?: string; name?: string; businessType?: string; email?: string; phone?: string; gstin?: string }> = [];
    try {
      incoming = JSON.parse(rawExtraCompanies || "[]");
    } catch {
      incoming = [];
    }
    if (!Array.isArray(incoming)) incoming = [];

    const existing = await this.prisma.company.findMany({ where: { tenantId } });
    const existingIds = new Set(existing.map((c) => c.id));
    const incomingIds = new Set(incoming.filter((c) => c.id && existingIds.has(c.id)).map((c) => c.id!));

    const toDelete = existing.filter((c) => !incomingIds.has(c.id));
    if (toDelete.length > 0) {
      await this.prisma.company.deleteMany({ where: { id: { in: toDelete.map((c) => c.id) } } });
    }

    for (const c of incoming) {
      if (!c.name) continue;
      const data = {
        name: c.name,
        businessType: c.businessType || null,
        email: c.email || null,
        phone: c.phone || null,
        gstin: c.gstin || null,
      };
      if (c.id && existingIds.has(c.id)) {
        await this.prisma.company.update({ where: { id: c.id }, data });
      } else {
        await this.prisma.company.create({ data: { tenantId, ...data } });
      }
    }
  }
}
