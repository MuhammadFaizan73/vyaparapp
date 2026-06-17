import { Controller, Get, Post, Patch, Delete, Body, Req, Param, UseGuards } from "@nestjs/common";
import { CashBankService } from "./cash-bank.service";
import { JwtGuard } from "../auth/jwt.guard";

interface AuthedRequest extends Request {
  tenantId: string;
}

@Controller("cash-bank")
@UseGuards(JwtGuard)
export class CashBankController {
  constructor(private readonly svc: CashBankService) {}

  @Get("cash-in-hand")
  getCashInHand(@Req() req: AuthedRequest) {
    return this.svc.getCashInHand(req.tenantId);
  }

  @Post("cash-in-hand/adjust")
  adjustCash(
    @Req() req: AuthedRequest,
    @Body() body: { mode: "add" | "reduce"; amount: number; date: string; description?: string },
  ) {
    return this.svc.adjustCash(req.tenantId, body);
  }

  // ── Bank Accounts ──────────────────────────────────────────────────────────

  @Get("banks")
  getBankAccounts(@Req() req: AuthedRequest) {
    return this.svc.getBankAccounts(req.tenantId);
  }

  @Post("banks")
  createBankAccount(
    @Req() req: AuthedRequest,
    @Body() body: { name: string; openingBalance?: number; openingBalanceDate?: string; printOnInvoices?: boolean },
  ) {
    return this.svc.createBankAccount(req.tenantId, body);
  }

  @Patch("banks/:id")
  updateBankAccount(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { name?: string; openingBalance?: number; openingBalanceDate?: string; printOnInvoices?: boolean },
  ) {
    return this.svc.updateBankAccount(req.tenantId, id, body);
  }

  @Delete("banks/:id")
  deleteBankAccount(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.svc.deleteBankAccount(req.tenantId, id);
  }
}
