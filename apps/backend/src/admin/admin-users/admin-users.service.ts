import { Injectable, ForbiddenException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.adminUser.findMany({
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(adminId: string, data: { name: string; email: string; password: string; role: string }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.adminUser.create({
      data: { name: data.name, email: data.email, passwordHash, role: data.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    await this.audit.log({ adminId, action: "create_admin_user", targetType: "admin_user", targetId: user.id });
    return user;
  }

  async updateRole(adminId: string, targetId: string, role: string) {
    if (adminId === targetId) throw new ForbiddenException("Cannot change your own role");
    await this.prisma.adminUser.update({ where: { id: targetId }, data: { role } });
    await this.audit.log({ adminId, action: "update_admin_role", targetType: "admin_user", targetId, meta: { role } });
  }

  async setActive(adminId: string, targetId: string, isActive: boolean) {
    if (adminId === targetId) throw new ForbiddenException("Cannot deactivate yourself");
    await this.prisma.adminUser.update({ where: { id: targetId }, data: { isActive } });
    await this.audit.log({ adminId, action: isActive ? "activate_admin_user" : "deactivate_admin_user", targetType: "admin_user", targetId });
  }

  async auditLog(opts: { adminId?: string; page: number; limit: number }) {
    const where: Record<string, unknown> = {};
    if (opts.adminId) where.adminId = opts.adminId;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, total, page: opts.page, limit: opts.limit };
  }
}
