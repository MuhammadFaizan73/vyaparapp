import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { PartiesService } from "./parties.service";
import { CreatePartyDto } from "./parties.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("parties")
@UseGuards(JwtGuard)
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.partiesService.list(req.tenantId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreatePartyDto) {
    return this.partiesService.create(req.tenantId, dto);
  }
}
