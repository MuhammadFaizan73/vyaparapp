import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from "@nestjs/common";
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from "class-validator";
import { AdminLicensesService } from "./licenses.service";
import { AdminGuard, AdminRequest, SuperAdminGuard } from "../admin-auth/admin.guard";

class GenerateDto {
  @IsInt() @Min(1) count!: number;
  @IsString() @IsIn(["desktop", "mobile", "both"]) platform!: string;
  @IsString() plan!: string;
  // "monthly"/"yearly" compute expiresAt from a fixed day count; "custom" requires customDays.
  @IsString() @IsIn(["monthly", "yearly", "custom"]) durationType!: string;
  @ValidateIf((o) => o.durationType === "custom") @IsInt() @Min(1) customDays?: number;
  @IsEmail() email!: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() phone?: string;
}

class ExtendDto {
  @IsInt() @Min(1) days!: number;
}

@UseGuards(AdminGuard)
@Controller("admin/licenses")
export class AdminLicensesController {
  constructor(private readonly svc: AdminLicensesService) {}

  @Get()
  list(
    @Query("status") status?: string,
    @Query("platform") platform?: string,
    @Query("email") email?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.svc.list({ status, platform, email, page: +page, limit: +limit });
  }

  @Get("expiring")
  expiring(@Query("days") days = "30") {
    return this.svc.expiringSoon(+days);
  }

  @UseGuards(SuperAdminGuard)
  @Post("generate")
  generate(@Body() dto: GenerateDto, @Request() req: AdminRequest) {
    return this.svc.generate(req.adminId, dto);
  }

  @UseGuards(SuperAdminGuard)
  @Patch(":id/extend")
  extend(@Param("id") id: string, @Body() dto: ExtendDto, @Request() req: AdminRequest) {
    return this.svc.extend(req.adminId, id, dto.days);
  }

  @UseGuards(SuperAdminGuard)
  @Patch(":id/revoke")
  revoke(@Param("id") id: string, @Request() req: AdminRequest) {
    return this.svc.revoke(req.adminId, id);
  }
}
