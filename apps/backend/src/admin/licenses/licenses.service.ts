import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const DURATION_DAYS: Record<string, number> = { monthly: 30, yearly: 365 };

// Crypto-random, not Math.random() (which is not a CSPRNG and was previously used here) —
// a license key is a security credential, not a display id.
function generateKey(platform: string) {
  const prefix = platform === "mobile" ? "MOBI" : platform === "both" ? "UNIV" : "DESK";
  const rand = () => randomBytes(3).toString("hex").toUpperCase();
  return `VYPR-${prefix}-${rand()}-${rand()}`;
}

@Injectable()
export class AdminLicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(opts: { status?: string; platform?: string; email?: string; page: number; limit: number }) {
    const { status, platform, email, page, limit } = opts;
    const now = new Date();

    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform;
    if (email) where.email = { equals: email.trim().toLowerCase() };

    const [licenses, total] = await Promise.all([
      this.prisma.license.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          desktopTenant: { select: { id: true, phone: true, companyName: true } },
          mobileTenant: { select: { id: true, phone: true, companyName: true } },
        },
      }),
      this.prisma.license.count({ where }),
    ]);

    const enriched = licenses.map((l) => {
      const tenant = l.desktopTenant || l.mobileTenant;
      let computedStatus = "unassigned";
      if (tenant) {
        computedStatus = l.expiresAt > now ? "active" : "expired";
      }
      if (status && computedStatus !== status) return null;
      return { ...l, tenant, computedStatus };
    }).filter(Boolean);

    return { data: enriched, total, page, limit };
  }

  async generate(adminId: string, opts: {
    count: number; platform: string; plan: string;
    durationType: string; customDays?: number;
    email: string; customerName?: string; phone?: string;
  }) {
    const { count, platform, plan, durationType, customDays, phone } = opts;
    const email = opts.email.trim().toLowerCase();
    const customerName = opts.customerName?.trim() || null;

    const daysValid = durationType === "custom" ? customDays! : DURATION_DAYS[durationType];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysValid);

    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      let key = generateKey(platform);
      // ensure unique
      while (await this.prisma.license.findUnique({ where: { key } })) {
        key = generateKey(platform);
      }
      await this.prisma.license.create({
        data: { key, plan, platform, expiresAt, phone: phone || null, email, customerName, durationType },
      });
      keys.push(key);
    }

    await this.audit.log({
      adminId,
      action: "generate_license",
      meta: { count, platform, plan, durationType, daysValid, email, customerName },
    });

    return { keys };
  }

  async extend(adminId: string, licenseId: string, days: number) {
    const license = await this.prisma.license.findUniqueOrThrow({ where: { id: licenseId } });
    const base = license.expiresAt > new Date() ? license.expiresAt : new Date();
    const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

    await this.prisma.license.update({ where: { id: licenseId }, data: { expiresAt: newExpiry } });

    await this.audit.log({
      adminId,
      action: "extend_license",
      targetType: "license",
      targetId: licenseId,
      meta: { days, newExpiry: newExpiry.toISOString() },
    });

    return { expiresAt: newExpiry };
  }

  async revoke(adminId: string, licenseId: string) {
    // Set expiry to past to immediately invalidate
    const past = new Date("2000-01-01");
    await this.prisma.license.update({ where: { id: licenseId }, data: { expiresAt: past } });

    await this.audit.log({
      adminId,
      action: "revoke_license",
      targetType: "license",
      targetId: licenseId,
    });
  }

  async expiringSoon(days: number) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.prisma.license.findMany({
      where: { expiresAt: { gte: now, lte: cutoff } },
      include: {
        desktopTenant: { select: { id: true, phone: true, companyName: true } },
        mobileTenant: { select: { id: true, phone: true, companyName: true } },
      },
      orderBy: { expiresAt: "asc" },
    });
  }
}
