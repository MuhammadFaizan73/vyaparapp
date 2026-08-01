import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { PartiesService } from "./parties.service";
import { CreatePartyDto, UpdatePartyDto } from "./parties.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("parties")
@UseGuards(JwtGuard)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query("companyId") companyId?: string) {
    return this.partiesService.list(req.tenantId, companyId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreatePartyDto) {
    return this.partiesService.create(req.tenantId, dto);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: UpdatePartyDto) {
    return this.partiesService.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.partiesService.remove(req.tenantId, id);
  }
}
