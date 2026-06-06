import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.isActive) throw new UnauthorizedException("Invalid credentials");

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log({ adminId: admin.id, action: "login" });

    const token = await this.jwt.signAsync(
      { sub: admin.id, role: admin.role, isAdmin: true },
      { expiresIn: "24h" },
    );

    return {
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminId },
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true },
    });
    return admin;
  }

  async impersonate(adminId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    await this.audit.log({
      adminId,
      action: "impersonate",
      targetType: "tenant",
      targetId: tenantId,
    });

    const token = await this.jwt.signAsync(
      { sub: tenantId, impersonated: true, impersonatedBy: adminId },
      { expiresIn: "1h" },
    );

    return { token, tenant: { id: tenant.id, phone: tenant.phone, companyName: tenant.companyName } };
  }
}
