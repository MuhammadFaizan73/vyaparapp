import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { DistributorsService } from "./distributors.service";
import { CreateDistributorDto, UpdateDistributorDto } from "./distributors.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("distributors")
@UseGuards(JwtGuard)
export class DistributorsController {
  constructor(private readonly distributorsService: DistributorsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.distributorsService.list(req.tenantId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateDistributorDto) {
    return this.distributorsService.create(req.tenantId, dto);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: UpdateDistributorDto) {
    return this.distributorsService.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.distributorsService.remove(req.tenantId, id);
  }
}
