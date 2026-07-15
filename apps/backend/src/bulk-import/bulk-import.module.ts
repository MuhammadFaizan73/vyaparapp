import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BulkImportController } from "./bulk-import.controller";
import { BulkImportService } from "./bulk-import.service";

@Module({
  imports: [AuthModule],
  controllers: [BulkImportController],
  providers: [BulkImportService],
})
export class BulkImportModule {}
