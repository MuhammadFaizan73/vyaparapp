import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StoresModule } from "../stores/stores.module";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
