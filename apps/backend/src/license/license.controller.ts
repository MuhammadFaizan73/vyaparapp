import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { LicenseService } from "./license.service";
import { ActivateLicenseDto } from "./license.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("license")
@UseGuards(JwtGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get("status")
  status(@Req() req: AuthedRequest) {
    return this.licenseService.status(req.tenantId);
  }

  @Post("activate")
  activate(@Req() req: AuthedRequest, @Body() dto: ActivateLicenseDto) {
    return this.licenseService.activate(req.tenantId, dto.key);
  }
}
