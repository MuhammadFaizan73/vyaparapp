import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";
import { CreateStoreDto, UpdateStoreDto } from "./stores.dto";
import { StoresService } from "./stores.service";
import { restrictCompanyIds } from "../common/company-filter.util";

@Controller("stores")
@UseGuards(JwtGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query("companyId") companyId?: string) {
    return this.storesService.list(req.tenantId, restrictCompanyIds(companyId, req.companyIds));
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateStoreDto) {
    return this.storesService.create(req.tenantId, dto);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: UpdateStoreDto) {
    return this.storesService.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.storesService.remove(req.tenantId, id);
  }
}
