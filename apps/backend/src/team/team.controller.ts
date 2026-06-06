import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, UseGuards, Req } from "@nestjs/common";
import { TeamService } from "./team.service";
import { CreateTeamMemberDto, UpdateRoleDto, UpdatePermissionsDto, AcceptInviteDto, StaffLoginDto } from "./team.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("team")
@UseGuards(JwtGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.team.list(req.tenantId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateTeamMemberDto) {
    return this.team.create(req.tenantId, dto);
  }

  @Patch(":id/role")
  updateRole(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.team.updateRole(req.tenantId, id, dto);
  }

  @Patch(":id/permissions")
  updatePermissions(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.team.updatePermissions(req.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.team.remove(req.tenantId, id);
  }
}

// Separate public controller — no JWT guard
@Controller("team-invite")
export class TeamInviteController {
  constructor(private readonly team: TeamService) {}

  @Post("accept")
  accept(@Body() dto: AcceptInviteDto) {
    return this.team.acceptInvite(dto.token);
  }

  @Post("login")
  login(@Body() dto: StaffLoginDto) {
    return this.team.staffLogin(dto);
  }
}
