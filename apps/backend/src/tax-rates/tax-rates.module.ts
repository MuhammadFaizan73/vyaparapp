import { Module } from "@nestjs/common";
import { TaxRatesController } from "./tax-rates.controller";
import { TaxRatesService } from "./tax-rates.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TaxRatesController],
  providers: [TaxRatesService],
})
export class TaxRatesModule {}
