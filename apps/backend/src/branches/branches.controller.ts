import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { CreateBranchDto, UpdateBranchDto } from "./branches.dto";
import { JwtGuard, type AuthedRequest } from "../auth/jwt.guard";

@Controller("branches")
@UseGuards(JwtGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query("distributorId") distributorId?: string) {
    return this.branchesService.list(req.tenantId, distributorId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(req.tenantId, dto);
  }

  @Patch(":id")
  update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(req.tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.branchesService.remove(req.tenantId, id);
  }
}
