import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CashBankController } from "./cash-bank.controller";
import { CashBankService } from "./cash-bank.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CashBankController],
  providers: [CashBankService],
})
export class CashBankModule {}
