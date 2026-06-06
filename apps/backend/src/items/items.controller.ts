import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ItemsService } from "./items.service";
import { CreateItemDto, UpdateItemDto } from "./items.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("items")
@UseGuards(JwtGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.itemsService.list(req.tenantId);
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
