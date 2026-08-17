import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StockTransfersController } from "./stock-transfers.controller";
import { StockTransfersService } from "./stock-transfers.service";
import { StockService } from "./stock.service";
import { StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

@Module({
  imports: [AuthModule],
  controllers: [StoresController, StockTransfersController],
  providers: [StoresService, StockService, StockTransfersService],
  exports: [StoresService, StockService],
})
export class StoresModule {}
