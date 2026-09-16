import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ActivateLicenseDto } from "./license.dto";

// Shows only the last 4 characters — this module's lookupByEmail() is reachable by
// anyone who knows the email (no ownership proof beyond that), so the response must
// never hand back a directly-usable key. Duplicated from admin/licenses/licenses.service.ts
// rather than imported, to keep this module independent of the admin module.
function maskKey(key: string): string {
  return key.length <= 4 ? key : `${"•".repeat(key.length - 4)}${key.slice(-4)}`;
}

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

export type LicenseListingEntry = {
  id: string;
  maskedKey: string;
  plan: string;
  platform: string;
  durationType: string;
  customerName: string | null;
  expiresAt: string;
  status: "available" | "expired" | "taken";
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

  // Every license bought under this email — the "Activate License" screen's email step.
  // Keys are masked: this is reachable by anyone who knows the email (no proof of
  // ownership beyond that), so it must never hand back something directly usable.
  async lookupByEmail(email: string): Promise<LicenseListingEntry[]> {
    const licenses = await this.prisma.license.findMany({
      where: { email: email.trim().toLowerCase() },
      include: { desktopTenant: { select: { id: true } }, mobileTenant: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    return licenses.map((l) => {
      const taken = !!(l.desktopTenant || l.mobileTenant);
      const status: LicenseListingEntry["status"] =
        l.expiresAt <= now ? "expired" : taken ? "taken" : "available";
      return {
        id: l.id,
        maskedKey: maskKey(l.key),
        plan: l.plan,
        platform: l.platform,
        durationType: l.durationType,
        customerName: l.customerName,
        expiresAt: l.expiresAt.toISOString(),
        status,
      };
    });
  }

  async activate(tenantId: string, dto: ActivateLicenseDto, platform: Platform): Promise<LicenseStatus> {
    const license = dto.licenseId
      ? await this.prisma.license.findUnique({ where: { id: dto.licenseId } })
      : await this.prisma.license.findUnique({ where: { key: dto.key! } });
    if (!license) throw new NotFoundException("License not found");

    // "both" was generated to cover either platform — everything else must match exactly.
    if (license.platform !== platform && license.platform !== "both") {
      throw new BadRequestException(
        `This key is for ${license.platform}, not ${platform}`,
      );
    }
    if (license.expiresAt <= new Date()) {
      throw new BadRequestException("License has expired");
    }

    if (license.email) {
      if (license.email.toLowerCase() !== dto.email.trim().toLowerCase()) {
        throw new BadRequestException("This license isn't registered to that email");
      }
    } else if (license.phone) {
      // Legacy phone-locked license, never re-issued against an email.
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (tenant?.phone !== license.phone) {
        throw new BadRequestException("This license key is assigned to a different mobile number");
      }
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
