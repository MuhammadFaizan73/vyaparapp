import { Body, Controller, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { AdminAuthService } from "./admin-auth.service";
import { AdminGuard, AdminRequest, SuperAdminGuard } from "./admin.guard";

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}

@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly svc: AdminAuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.svc.login(dto.email, dto.password);
  }

  @UseGuards(AdminGuard)
  @Get("me")
  me(@Request() req: AdminRequest) {
    return this.svc.getMe(req.adminId);
  }

  @UseGuards(SuperAdminGuard)
  @Post("impersonate/:tenantId")
  impersonate(@Request() req: AdminRequest, @Param("tenantId") tenantId: string) {
    return this.svc.impersonate(req.adminId, tenantId);
  }
}
