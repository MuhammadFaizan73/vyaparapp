import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AdminTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(opts: { search?: string; status?: string; platform?: string; page: number; limit: number }) {
    const { search, status, platform, page, limit } = opts;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { companyName: { contains: search } },
      ];
    }
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          phone: true,
          companyName: true,
          countryCode: true,
          isActive: true,
          lastActiveAt: true,
          createdAt: true,
          trialExpiresAt: true,
          desktopLicenseId: true,
          mobileLicenseId: true,
          desktopLicense: { select: { expiresAt: true, plan: true } },
          mobileLicense: { select: { expiresAt: true, plan: true } },
          _count: { select: { parties: true, items: true, teamMembers: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const now = new Date();
    const enriched = tenants.map((t) => {
      let licenseStatus = "trial";
      const deskExp = t.desktopLicense?.expiresAt;
      const mobExp = t.mobileLicense?.expiresAt;
      const anyExp = deskExp || mobExp;
      if (anyExp) {
        licenseStatus = anyExp > now ? "active" : "expired";
      } else if (t.trialExpiresAt < now) {
        licenseStatus = "expired";
      }

      let platforms: string[] = [];
      if (t.desktopLicenseId) platforms.push("desktop");
      if (t.mobileLicenseId) platforms.push("mobile");
      if (platforms.length === 0) platforms = ["trial"];

      return { ...t, licenseStatus, platforms };
    });

    // filter by platform if requested
    const filtered = platform
      ? enriched.filter((t) => t.platforms.includes(platform))
      : enriched;

    return { data: filtered, total, page, limit };
  }

  async detail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        desktopLicense: true,
        mobileLicense: true,
        teamMembers: { select: { id: true, name: true, role: true, email: true, status: true } },
        _count: { select: { parties: true, items: true, teamMembers: true } },
      },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  async recentActivity(id: string) {
    return this.prisma.transactionHistory.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, changes: true, ipAddress: true, createdAt: true },
    });
  }

  async setActive(id: string, isActive: boolean, adminId: string) {
    await this.prisma.tenant.update({ where: { id }, data: { isActive } });
    await this.audit.log({
      adminId,
      action: isActive ? "activate_tenant" : "deactivate_tenant",
      targetType: "tenant",
      targetId: id,
    });
  }

  async stats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [total, newThisMonth, active, expired, expiring7, expiring30] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.license.count({ where: { expiresAt: { lt: now } } }),
      this.prisma.license.count({ where: { expiresAt: { gte: now, lte: sevenDaysLater } } }),
      this.prisma.license.count({ where: { expiresAt: { gte: now, lte: thirtyDaysLater } } }),
    ]);

    // daily registrations for last 30 days
    const recentTenants = await this.prisma.tenant.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyMap: Record<string, number> = {};
    for (const t of recentTenants) {
      const day = t.createdAt.toISOString().slice(0, 10);
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    }
    const dailyRegistrations = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    return { total, newThisMonth, active, expired, expiring7, expiring30, dailyRegistrations };
  }
}
