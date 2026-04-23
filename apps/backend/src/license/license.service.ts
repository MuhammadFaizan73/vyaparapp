import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type LicenseStatus = {
  state: "trial" | "trial_expired" | "licensed" | "license_expired";
  trialStartedAt: string;
  trialExpiresAt: string;
  daysRemaining: number;
  license: null | {
    key: string;
    plan: string;
    activatedAt: string | null;
    expiresAt: string;
  };
};

@Injectable()
export class LicenseService {
  constructor(private readonly prisma: PrismaService) {}

  async status(tenantId: string): Promise<LicenseStatus> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { license: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const now = new Date();
    const trialDays = Math.ceil(
      (tenant.trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    let state: LicenseStatus["state"];
    if (tenant.license) {
      state = tenant.license.expiresAt > now ? "licensed" : "license_expired";
    } else {
      state = tenant.trialExpiresAt > now ? "trial" : "trial_expired";
    }

    return {
      state,
      trialStartedAt: tenant.trialStartedAt.toISOString(),
      trialExpiresAt: tenant.trialExpiresAt.toISOString(),
      daysRemaining: state === "trial" ? Math.max(0, trialDays) : 0,
      license: tenant.license
        ? {
            key: tenant.license.key,
            plan: tenant.license.plan,
            activatedAt: tenant.license.activatedAt?.toISOString() ?? null,
            expiresAt: tenant.license.expiresAt.toISOString(),
          }
        : null,
    };
  }

  async activate(tenantId: string, key: string): Promise<LicenseStatus> {
    const license = await this.prisma.license.findUnique({ where: { key } });
    if (!license) throw new NotFoundException("License key not found");
    if (license.expiresAt <= new Date()) {
      throw new BadRequestException("License has expired");
    }

    const existing = await this.prisma.tenant.findFirst({
      where: { licenseId: license.id, NOT: { id: tenantId } },
    });
    if (existing) {
      throw new BadRequestException("License is already assigned to another account");
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        licenseId: license.id,
      },
    });

    if (!license.activatedAt) {
      await this.prisma.license.update({
        where: { id: license.id },
        data: { activatedAt: new Date() },
      });
    }

    return this.status(tenantId);
  }
}
