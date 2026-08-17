import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";
import { StockTransfersService } from "./stock-transfers.service";
import { CreateStockTransferDto } from "./stores.dto";

@Controller("stock-transfers")
@UseGuards(JwtGuard)
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("companyId") companyId?: string,
    @Query("take") take?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.stockTransfersService.list(req.tenantId, {
      companyId,
      take: take ? Number(take) : undefined,
      from,
      to,
    });
  }

  @Get(":id")
  findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.stockTransfersService.findOne(req.tenantId, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateStockTransferDto) {
    return this.stockTransfersService.create(req.tenantId, dto);
  }
}
