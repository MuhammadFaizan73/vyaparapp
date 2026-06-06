import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from "@nestjs/common";
import { JwtGuard, AuthedRequest } from "../auth/jwt.guard";
import { PartyGroupsService } from "./party-groups.service";

@UseGuards(JwtGuard)
@Controller("party-groups")
export class PartyGroupsController {
  constructor(private svc: PartyGroupsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.tenantId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body("name") name: string) {
    return this.svc.create(req.tenantId, name);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.svc.remove(req.tenantId, id);
  }
}
