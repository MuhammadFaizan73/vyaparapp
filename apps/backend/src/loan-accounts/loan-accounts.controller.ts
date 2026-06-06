import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from "@nestjs/common";
import { LoanAccountsService, CreateLoanAccountDto } from "./loan-accounts.service";
import { JwtGuard } from "../auth/jwt.guard";

interface AuthedRequest extends Request { tenantId: string; }

@Controller("loan-accounts")
@UseGuards(JwtGuard)
export class LoanAccountsController {
  constructor(private readonly svc: LoanAccountsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.svc.list(req.tenantId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateLoanAccountDto) {
    return this.svc.create(req.tenantId, dto);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: Partial<CreateLoanAccountDto>) {
    return this.svc.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.svc.remove(req.tenantId, id);
  }
}
