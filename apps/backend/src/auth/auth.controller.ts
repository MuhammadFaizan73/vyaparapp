import { Body, Controller, Post, Get, Patch, UseGuards, Req } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto, UpdateTenantDto } from "./auth.dto";
import { JwtGuard, type AuthedRequest } from "./jwt.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
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
