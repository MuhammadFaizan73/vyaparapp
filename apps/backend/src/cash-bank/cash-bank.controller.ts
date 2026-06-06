import { Controller, Get, Post, Body, Req, UseGuards } from "@nestjs/common";
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
}
