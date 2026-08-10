import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTeamMemberDto, UpdateRoleDto, UpdatePermissionsDto, StaffLoginDto } from "./team.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.teamMember.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, tenantId: true, name: true, contact: true, email: true,
        role: true, permissions: true, status: true, createdAt: true, updatedAt: true,
      },
    });
  }

  async create(tenantId: string, dto: CreateTeamMemberDto) {
    if (!dto.email && !dto.contact) {
      throw new BadRequestException("Provide an email or a phone number.");
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const member = await this.prisma.teamMember.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        contact: dto.contact ?? "",
        role: dto.role,
        permissions: JSON.stringify(dto.permissions ?? []),
        status: "active",
      },
    });
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      contact: member.contact,
      role: member.role,
      status: member.status,
      createdAt: member.createdAt,
    };
  }

  async staffLogin(dto: StaffLoginDto) {
    if (!dto.identifier) {
      throw new UnauthorizedException("Invalid email/phone or password.");
    }
    // Phone (contact) has no uniqueness constraint, so a lookup can return several
    // members across tenants sharing the same number — the password decides which one.
    const candidates = await this.prisma.teamMember.findMany({
      where: { OR: [{ email: dto.identifier }, { contact: dto.identifier }] },
      include: { tenant: true },
    });

    let member: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (candidate.passwordHash && (await bcrypt.compare(dto.password, candidate.passwordHash))) {
        member = candidate;
        break;
      }
    }
    if (!member) {
      throw new UnauthorizedException("Invalid email/phone or password.");
    }

    const permissions = (() => {
      try { return JSON.parse(member.permissions); } catch { return []; }
    })();

    const token = await this.jwt.signAsync({
      sub: member.tenantId,
      memberId: member.id,
      role: member.role,
      permissions,
    });

    return {
      token,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        contact: member.contact,
        role: member.role,
        permissions,
      },
      tenant: {
        id: member.tenant.id,
        phone: member.tenant.phone,
        trialExpiresAt: member.tenant.trialExpiresAt.toISOString(),
      },
    };
  }

  async updateRole(tenantId: string, id: string, dto: UpdateRoleDto) {
    const existing = await this.prisma.teamMember.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Team member not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    return this.prisma.teamMember.update({
      where: { id },
      data: { role: dto.role },
    });
  }

  async updatePermissions(tenantId: string, id: string, dto: UpdatePermissionsDto) {
    const existing = await this.prisma.teamMember.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Team member not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    return this.prisma.teamMember.update({
      where: { id },
      data: { permissions: JSON.stringify(dto.permissions) },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.teamMember.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Team member not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    return this.prisma.teamMember.delete({ where: { id } });
  }

  async acceptInvite(token: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { inviteToken: token },
      include: { tenant: true },
    });
    if (!member) throw new NotFoundException("Invalid or expired invite code.");

    await this.prisma.teamMember.update({
      where: { id: member.id },
      data: { status: "active" },
    });

    const permissions = (() => {
      try { return JSON.parse(member.permissions); } catch { return []; }
    })();

    const jwtToken = await this.jwt.signAsync({
      sub: member.tenantId,
      memberId: member.id,
      role: member.role,
      permissions,
    });

    return {
      token: jwtToken,
      member: {
        id: member.id,
        name: member.name,
        contact: member.contact,
        role: member.role,
        permissions,
      },
      tenant: {
        id: member.tenant.id,
        phone: member.tenant.phone,
        trialExpiresAt: member.tenant.trialExpiresAt.toISOString(),
      },
    };
  }
}
