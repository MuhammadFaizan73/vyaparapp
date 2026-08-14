import { Body, Controller, Post, Get, Patch, UseGuards, Req, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto, UpdateTenantDto, SendOtpDto, VerifyOtpDto } from "./auth.dto";
import { JwtGuard, type AuthedRequest } from "./jwt.guard";
import { SmsService } from "../sms/sms.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly smsService: SmsService,
  ) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Additive: doesn't touch /auth/register, which stays exactly as it works today.
  // Wiring OTP into the actual onboarding flow (mobile's onboarding.tsx) is a separate
  // decision once MSG91's delivery to Pakistani numbers is verified live.
  @Post("send-otp")
  async sendOtp(@Body() dto: SendOtpDto) {
    await this.smsService.sendOtp(dto.countryCode, dto.phone);
    return { sent: true };
  }

  @Post("verify-otp")
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const ok = await this.smsService.verifyOtp(dto.countryCode, dto.phone, dto.otp);
    if (!ok) throw new UnauthorizedException("Incorrect or expired code.");
    // On success, this is a verified registration — reuse the exact same
    // find-or-create-tenant + issue-JWT logic /auth/register already uses.
    return this.authService.register({ countryCode: dto.countryCode, phone: dto.phone });
  }

  @Post("resend-otp")
  async resendOtp(@Body() dto: SendOtpDto) {
    await this.smsService.resendOtp(dto.countryCode, dto.phone);
    return { sent: true };
  }

  @Get("tenant")
  @UseGuards(JwtGuard)
  getTenant(@Req() req: AuthedRequest) {
    return this.authService.getTenant(req.tenantId);
  }

  @Patch("tenant")
  @UseGuards(JwtGuard)
  updateTenant(@Req() req: AuthedRequest, @Body() dto: UpdateTenantDto) {
    return this.authService.updateTenant(req.tenantId, dto);
  }
}
