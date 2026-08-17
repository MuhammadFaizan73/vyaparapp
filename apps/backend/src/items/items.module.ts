import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoresModule } from "../stores/stores.module";
import { ItemsController } from "./items.controller";
import { ItemsService } from "./items.service";

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
