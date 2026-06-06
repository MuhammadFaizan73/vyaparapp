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
    const fullPhone = `${dto.countryCode}${dto.phone}`;

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
    return {
      ...t,
      extraCompanies: (() => { try { return JSON.parse(t.extraCompanies); } catch { return []; } })(),
    };
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto) {
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
      extraCompanies: (() => { try { return JSON.parse(t.extraCompanies); } catch { return []; } })(),
    };
  }
}
