import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminHealthService } from "./health.service";
import { AdminGuard } from "../admin-auth/admin.guard";

@UseGuards(AdminGuard)
@Controller("admin/health")
export class AdminHealthController {
  constructor(private readonly svc: AdminHealthService) {}

  @Get()
  stats() {
    return this.svc.getStats();
  }

  @Get("chart")
  chart() {
    return this.svc.getHourlyChart();
  }
}
