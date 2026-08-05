import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from "@nestjs/common";
import { JwtGuard, AuthedRequest } from "../auth/jwt.guard";
import { TaxRatesService } from "./tax-rates.service";

@UseGuards(JwtGuard)
@Controller("tax-rates")
export class TaxRatesController {
  constructor(private svc: TaxRatesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.tenantId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body("name") name: string, @Body("rate") rate: number) {
    return this.svc.create(req.tenantId, name, rate);
  }

  @Patch(":id")
  update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body("name") name: string,
    @Body("rate") rate: number,
  ) {
    return this.svc.update(req.tenantId, id, name, rate);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.svc.remove(req.tenantId, id);
  }
}
