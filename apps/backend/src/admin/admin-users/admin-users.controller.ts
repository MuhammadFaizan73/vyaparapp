import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from "@nestjs/common";
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AdminUsersService } from "./admin-users.service";
import { AdminGuard, AdminRequest, SuperAdminGuard } from "../admin-auth/admin.guard";

class CreateAdminDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
  @IsString() @IsIn(["superadmin", "support", "readonly"]) role!: string;
}

class UpdateRoleDto {
  @IsString() @IsIn(["superadmin", "support", "readonly"]) role!: string;
}

class SetActiveDto {
  @IsBoolean() isActive!: boolean;
}

@UseGuards(SuperAdminGuard)
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly svc: AdminUsersService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreateAdminDto, @Request() req: AdminRequest) {
    return this.svc.create(req.adminId, dto);
  }

  @Patch(":id/role")
  updateRole(@Param("id") id: string, @Body() dto: UpdateRoleDto, @Request() req: AdminRequest) {
    return this.svc.updateRole(req.adminId, id, dto.role);
  }

  @Patch(":id/active")
  setActive(@Param("id") id: string, @Body() dto: SetActiveDto, @Request() req: AdminRequest) {
    return this.svc.setActive(req.adminId, id, dto.isActive);
  }

  @UseGuards(AdminGuard)
  @Get("audit-log")
  auditLog(
    @Query("adminId") adminId?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.svc.auditLog({ adminId, page: +page, limit: +limit });
  }
}
