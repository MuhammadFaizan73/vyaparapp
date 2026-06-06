import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { LoanAccountsController } from "./loan-accounts.controller";
import { LoanAccountsService } from "./loan-accounts.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LoanAccountsController],
  providers: [LoanAccountsService],
})
export class LoanAccountsModule {}
