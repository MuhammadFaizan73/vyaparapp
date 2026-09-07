import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ItemsService } from "./items.service";
import { CreateItemDto, UpdateItemDto } from "./items.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";
import { restrictCompanyIds } from "../common/company-filter.util";

@Controller("items")
@UseGuards(JwtGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query("companyId") companyId?: string) {
    return this.itemsService.list(req.tenantId, { companyId: restrictCompanyIds(companyId, req.companyIds) });
  }

  // Paginated + searchable, unlike list() above — for screens that browse/search the
  // catalog instead of needing it all at once (list() stays untouched for callers that
  // genuinely need the full catalog, e.g. backup export, mobile's offline item cache).
  @Get("search")
  search(
    @Req() req: AuthedRequest,
    @Query("companyId") companyId?: string,
    @Query("q") q?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.itemsService.search(req.tenantId, {
      companyId: restrictCompanyIds(companyId, req.companyIds),
      q,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateItemDto) {
    return this.itemsService.create(req.tenantId, dto);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: UpdateItemDto) {
    return this.itemsService.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.itemsService.remove(req.tenantId, id);
  }
}
