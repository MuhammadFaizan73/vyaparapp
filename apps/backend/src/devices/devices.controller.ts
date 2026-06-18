import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { DevicesService } from "./devices.service";
import { RegisterDeviceDto } from "./devices.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("devices")
@UseGuards(JwtGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post("register")
  register(@Req() req: AuthedRequest, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(req.tenantId, dto);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.devicesService.list(req.tenantId);
  }

  @Post(":id/activate")
  activate(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.devicesService.activate(req.tenantId, id);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.devicesService.remove(req.tenantId, id);
  }
}
