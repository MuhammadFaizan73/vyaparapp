import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SmsModule } from "../sms/sms.module";
import { PartiesController } from "./parties.controller";
import { PartiesService } from "./parties.service";

@Module({
  imports: [AuthModule, SmsModule],
  controllers: [PartiesController],
  providers: [PartiesService],
  exports: [PartiesService],
})
export class PartiesModule {}
