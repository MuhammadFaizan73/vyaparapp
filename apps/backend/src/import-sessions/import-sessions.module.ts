import { Module } from "@nestjs/common";
import { ImportSessionsController } from "./import-sessions.controller";
import { ImportSessionsService } from "./import-sessions.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ImportSessionsController],
  providers: [ImportSessionsService],
})
export class ImportSessionsModule {}
