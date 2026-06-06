import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from "@nestjs/common";
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AdminSupportService } from "./support.service";
import { AdminGuard, AdminRequest } from "../admin-auth/admin.guard";
import { JwtGuard, AuthedRequest } from "../../auth/jwt.guard";

class CreateTicketDto {
  @IsString() @IsNotEmpty() subject!: string;
  @IsString() issueType!: string;
  @IsString() @IsNotEmpty() body!: string;
}

class ReplyDto {
  @IsString() @IsNotEmpty() body!: string;
  @IsBoolean() @IsOptional() isInternal?: boolean;
}

class UpdateStatusDto {
  @IsString() @IsIn(["open", "in_progress", "resolved", "closed"]) status!: string;
  @IsString() @IsOptional() assignedToId?: string;
}

@Controller("admin/support")
export class AdminSupportController {
  constructor(private readonly svc: AdminSupportService) {}

  // Tenant-facing: create ticket
  @UseGuards(JwtGuard)
  @Post("tickets")
  createTicket(@Request() req: AuthedRequest, @Body() dto: CreateTicketDto) {
    return this.svc.createTicket(req.tenantId, dto.subject, dto.issueType, dto.body);
  }

  // Admin-facing
  @UseGuards(AdminGuard)
  @Get("tickets")
  list(
    @Query("status") status?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.svc.listTickets({ status, page: +page, limit: +limit });
  }

  @UseGuards(AdminGuard)
  @Get("tickets/:id")
  getTicket(@Param("id") id: string) {
    return this.svc.getTicket(id);
  }

  @UseGuards(AdminGuard)
  @Post("tickets/:id/reply")
  reply(@Param("id") id: string, @Body() dto: ReplyDto, @Request() req: AdminRequest) {
    return this.svc.replyTicket(req.adminId, id, dto.body, dto.isInternal ?? false);
  }

  @UseGuards(AdminGuard)
  @Patch("tickets/:id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateStatusDto, @Request() req: AdminRequest) {
    return this.svc.updateStatus(req.adminId, id, dto.status, dto.assignedToId);
  }
}
