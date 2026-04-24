import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { LicenseService, type Platform } from "./license.service";
import { ActivateLicenseDto } from "./license.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("license")
@UseGuards(JwtGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get("status")
  status(@Req() req: AuthedRequest, @Query("platform") platform: string) {
    const p: Platform = platform === "mobile" ? "mobile" : "desktop";
    return this.licenseService.status(req.tenantId, p);
  }

  @Post("activate")
  activate(@Req() req: AuthedRequest, @Body() dto: ActivateLicenseDto) {
    return this.licenseService.activate(req.tenantId, dto.key, dto.platform);
  }
}
