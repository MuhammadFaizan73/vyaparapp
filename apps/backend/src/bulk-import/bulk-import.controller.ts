import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { BulkImportService } from "./bulk-import.service";
import { BulkSaleImportRequestDto } from "./bulk-import.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("bulk-import")
@UseGuards(JwtGuard)
export class BulkImportController {
  constructor(private readonly bulkImportService: BulkImportService) {}

  @Post("sale-history")
  start(@Req() req: AuthedRequest, @Body() dto: BulkSaleImportRequestDto) {
    return this.bulkImportService.start(req.tenantId, dto);
  }

  @Get("sale-history/:jobId")
  status(@Param("jobId") jobId: string) {
    const status = this.bulkImportService.getStatus(jobId);
    if (!status) throw new NotFoundException("Import job not found");
    return status;
  }
}
