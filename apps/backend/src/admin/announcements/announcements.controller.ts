import { Body, Controller, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AdminAnnouncementsService } from "./announcements.service";
import { AdminGuard, AdminRequest } from "../admin-auth/admin.guard";
import { JwtGuard, AuthedRequest } from "../../auth/jwt.guard";

class CreateAnnouncementDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() body!: string;
  @IsString() @IsIn(["info", "warning", "critical"]) type!: string;
  @IsString() @IsIn(["all", "platform", "license_type", "tenant"]) target!: string;
  @IsString() @IsOptional() targetValue?: string;
  @IsString() @IsOptional() scheduledAt?: string;
  @IsString() @IsOptional() expiresAt?: string;
}

@Controller("admin/announcements")
export class AdminAnnouncementsController {
  constructor(private readonly svc: AdminAnnouncementsService) {}

  @UseGuards(AdminGuard)
  @Get()
  list() {
    return this.svc.list();
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateAnnouncementDto, @Request() req: AdminRequest) {
    return this.svc.create(req.adminId, dto);
  }

  // Tenant-facing
  @UseGuards(JwtGuard)
  @Get("for-me")
  forMe(@Request() req: AuthedRequest) {
    return this.svc.getForTenant(req.tenantId);
  }

  @UseGuards(JwtGuard)
  @Post(":id/read")
  markRead(@Param("id") id: string, @Request() req: AuthedRequest) {
    return this.svc.markRead(req.tenantId, id);
  }
}
