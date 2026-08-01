import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CompaniesService } from "./companies.service";
import { CreateCompanyDto, UpdateCompanyDto } from "./companies.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("companies")
@UseGuards(JwtGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.companiesService.list(req.tenantId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(req.tenantId, dto);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.companiesService.remove(req.tenantId, id);
  }
}
