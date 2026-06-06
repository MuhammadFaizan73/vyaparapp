import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PartyAssignmentsService } from "./party-assignments.service";
import { CreateAssignmentDto, UpdateAssignmentDto } from "./party-assignments.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("party-assignments")
@UseGuards(JwtGuard)
export class PartyAssignmentsController {
  constructor(private readonly service: PartyAssignmentsService) {}

  /** Admin/owner only — list all assignments for the tenant */
  @Get()
  findAll(@Req() req: AuthedRequest) {
    if (req.memberId) throw new ForbiddenException("Admin only");
    return this.service.findAll(req.tenantId);
  }

  /** Admin/owner only — create (or upsert) an assignment */
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateAssignmentDto) {
    if (req.memberId) throw new ForbiddenException("Admin only");
    return this.service.create(req.tenantId, dto);
  }

  /** Salesman — returns only their own assignments */
  @Get("mine")
  mine(@Req() req: AuthedRequest) {
    // If no memberId in token the owner has no personal assignments
    const memberId = req.memberId ?? "";
    return this.service.findByMember(req.tenantId, memberId);
  }

  /** Admin/owner only — update visitDays */
  @Patch(":id")
  update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    if (req.memberId) throw new ForbiddenException("Admin only");
    return this.service.update(req.tenantId, id, dto);
  }

  /** Admin/owner only — remove an assignment */
  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    if (req.memberId) throw new ForbiddenException("Admin only");
    return this.service.remove(req.tenantId, id);
  }
}
