import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { LicenseService, type Platform } from "./license.service";
import { ActivateLicenseDto, LookupLicensesDto } from "./license.dto";
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

  // Powers the "Activate License" screen's email step: what licenses exist for this
  // email, so the tenant can pick one instead of needing to already have the key in
  // hand. Keys come back masked (see AdminLicensesService.maskKey) — this list is
  // reachable by anyone who knows the email, so it must never leak a usable key.
  @Post("lookup")
  lookup(@Body() dto: LookupLicensesDto) {
    return this.licenseService.lookupByEmail(dto.email);
  }

  @Post("activate")
  activate(@Req() req: AuthedRequest, @Body() dto: ActivateLicenseDto) {
    return this.licenseService.activate(req.tenantId, dto, dto.platform);
  }
}
