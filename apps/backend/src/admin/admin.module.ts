import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";

import { AuditService } from "./audit/audit.service";

import { AdminAuthController } from "./admin-auth/admin-auth.controller";
import { AdminAuthService } from "./admin-auth/admin-auth.service";
import { AdminGuard, SuperAdminGuard } from "./admin-auth/admin.guard";

import { AdminTenantsController } from "./tenants/tenants.controller";
import { AdminTenantsService } from "./tenants/tenants.service";

import { AdminLicensesController } from "./licenses/licenses.controller";
import { AdminLicensesService } from "./licenses/licenses.service";

import { AdminSupportController } from "./support/support.controller";
import { AdminSupportService } from "./support/support.service";

import { AdminAnnouncementsController } from "./announcements/announcements.controller";
import { AdminAnnouncementsService } from "./announcements/announcements.service";

import { AdminHealthController } from "./health/health.controller";
import { AdminHealthService } from "./health/health.service";

import { AdminUsersController } from "./admin-users/admin-users.controller";
import { AdminUsersService } from "./admin-users/admin-users.service";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({ secret: process.env.JWT_SECRET ?? "changeme", global: false }),
  ],
  controllers: [
    AdminAuthController,
    AdminTenantsController,
    AdminLicensesController,
    AdminSupportController,
    AdminAnnouncementsController,
    AdminHealthController,
    AdminUsersController,
  ],
  providers: [
    AuditService,
    AdminAuthService,
    AdminGuard,
    SuperAdminGuard,
    AdminTenantsService,
    AdminLicensesService,
    AdminSupportService,
    AdminAnnouncementsService,
    AdminHealthService,
    AdminUsersService,
  ],
  exports: [AdminHealthService],
})
export class AdminModule {}
