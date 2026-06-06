import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AdminAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { reads: true } } },
    });
  }

  async create(adminId: string, data: {
    title: string;
    body: string;
    type: string;
    target: string;
    targetValue?: string;
    scheduledAt?: string;
    expiresAt?: string;
  }) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: data.title,
        body: data.body,
        type: data.type,
        target: data.target,
        targetValue: data.targetValue,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        // If no scheduledAt, mark as sent now
        sentAt: !data.scheduledAt ? new Date() : null,
      },
    });

    await this.audit.log({
      adminId,
      action: "send_announcement",
      targetType: "announcement",
      targetId: announcement.id,
      meta: { title: data.title, target: data.target },
    });

    return announcement;
  }

  // Tenant-facing: get active announcements not yet read by this tenant
  async getForTenant(tenantId: string) {
    const now = new Date();
    const announcements = await this.prisma.announcement.findMany({
      where: {
        sentAt: { not: null, lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { sentAt: "desc" },
    });

    const reads = await this.prisma.announcementRead.findMany({
      where: { tenantId },
      select: { announcementId: true },
    });
    const readIds = new Set(reads.map((r) => r.announcementId));

    return announcements
      .filter((a) => {
        if (a.target === "all") return true;
        return !readIds.has(a.id);
      })
      .map((a) => ({ ...a, isRead: readIds.has(a.id) }));
  }

  async markRead(tenantId: string, announcementId: string) {
    await this.prisma.announcementRead.upsert({
      where: { announcementId_tenantId: { announcementId, tenantId } },
      create: { announcementId, tenantId },
      update: {},
    });
  }
}
