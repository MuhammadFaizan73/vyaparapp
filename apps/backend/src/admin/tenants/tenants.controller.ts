import { Controller, Get, Param, Patch, Body, Query, Request, UseGuards } from "@nestjs/common";
import { IsBoolean } from "class-validator";
import { AdminTenantsService } from "./tenants.service";
import { AdminGuard, AdminRequest, SuperAdminGuard } from "../admin-auth/admin.guard";

class SetActiveDto {
  @IsBoolean() isActive!: boolean;
}

@UseGuards(AdminGuard)
@Controller("admin/tenants")
export class AdminTenantsController {
  constructor(private readonly svc: AdminTenantsService) {}

  @Get("stats")
  stats() {
    return this.svc.stats();
  }

  @Get()
  list(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("platform") platform?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.svc.list({ search, status, platform, page: +page, limit: +limit });
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.svc.detail(id);
  }

  @Get(":id/activity")
  activity(@Param("id") id: string) {
    return this.svc.recentActivity(id);
  }

  @UseGuards(SuperAdminGuard)
  @Patch(":id/active")
  setActive(@Param("id") id: string, @Body() dto: SetActiveDto, @Request() req: AdminRequest) {
    return this.svc.setActive(id, dto.isActive, req.adminId);
  }
}
