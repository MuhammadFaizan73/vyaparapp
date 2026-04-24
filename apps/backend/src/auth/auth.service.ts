import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./auth.dto";

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
}
