import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type Platform = "desktop" | "mobile";

export type LicenseStatus = {
  state: "trial" | "trial_expired" | "licensed" | "license_expired";
  platform: Platform;
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

  async status(tenantId: string, platform: Platform): Promise<LicenseStatus> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { desktopLicense: true, mobileLicense: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const license = platform === "desktop" ? tenant.desktopLicense : tenant.mobileLicense;
    const now = new Date();
    const trialDays = Math.ceil(
      (tenant.trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    let state: LicenseStatus["state"];
    if (license) {
      state = license.expiresAt > now ? "licensed" : "license_expired";
    } else {
      state = tenant.trialExpiresAt > now ? "trial" : "trial_expired";
    }

    return {
      state,
      platform,
      trialStartedAt: tenant.trialStartedAt.toISOString(),
      trialExpiresAt: tenant.trialExpiresAt.toISOString(),
      daysRemaining: state === "trial" ? Math.max(0, trialDays) : 0,
      license: license
        ? {
            key: license.key,
            plan: license.plan,
            activatedAt: license.activatedAt?.toISOString() ?? null,
            expiresAt: license.expiresAt.toISOString(),
          }
        : null,
    };
  }

  async activate(tenantId: string, key: string, platform: Platform): Promise<LicenseStatus> {
    const license = await this.prisma.license.findUnique({ where: { key } });
    if (!license) throw new NotFoundException("License key not found");
    if (license.platform !== platform) {
      throw new BadRequestException(
        `This key is for ${license.platform}, not ${platform}`,
      );
    }
    if (license.expiresAt <= new Date()) {
      throw new BadRequestException("License has expired");
    }

    const conflictField = platform === "desktop" ? "desktopLicenseId" : "mobileLicenseId";
    const existing = await this.prisma.tenant.findFirst({
      where: { [conflictField]: license.id, NOT: { id: tenantId } },
    });
    if (existing) {
      throw new BadRequestException("License is already assigned to another account");
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { [conflictField]: license.id },
    });

    if (!license.activatedAt) {
      await this.prisma.license.update({
        where: { id: license.id },
        data: { activatedAt: new Date() },
      });
    }

    return this.status(tenantId, platform);
  }
}
