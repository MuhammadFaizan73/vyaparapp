import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { TransactionsService } from "./transactions.service";
import { CreateTransactionDto, UpdateTransactionDto } from "./transactions.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("transactions")
@UseGuards(JwtGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("partyId") partyId?: string,
    @Query("type") type?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    if (partyId) return this.transactionsService.listForParty(req.tenantId, partyId);
    if (type) {
      return this.transactionsService.listByType(req.tenantId, type, {
        take: take ? Number(take) : undefined,
        skip: skip ? Number(skip) : undefined,
        from,
        to,
      });
    }
    return this.transactionsService.listAll(req.tenantId);
  }

  @Get("summary")
  summary(@Req() req: AuthedRequest, @Query("type") type: string) {
    return this.transactionsService.summaryByType(req.tenantId, type);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.tenantId, dto);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: UpdateTransactionDto) {
    const ip = (req as any).ip ?? (req as any).socket?.remoteAddress ?? undefined;
    return this.transactionsService.update(req.tenantId, id, dto, ip);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.transactionsService.remove(req.tenantId, id);
  }

  @Get(":id/history")
  history(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.transactionsService.getHistory(req.tenantId, id);
  }
}
