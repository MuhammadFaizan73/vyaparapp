import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LicenseController } from "./license.controller";
import { LicenseService } from "./license.service";

@Module({
  imports: [AuthModule],
  controllers: [LicenseController],
  providers: [LicenseService],
})
export class LicenseModule {}
