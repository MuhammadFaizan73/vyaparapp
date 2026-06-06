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
  ) {
    if (partyId) return this.transactionsService.listForParty(req.tenantId, partyId);
    if (type) return this.transactionsService.listByType(req.tenantId, type);
    return this.transactionsService.listAll(req.tenantId);
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
