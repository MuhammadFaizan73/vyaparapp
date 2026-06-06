import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PartyAssignmentsController } from "./party-assignments.controller";
import { PartyAssignmentsService } from "./party-assignments.service";

@Module({
  imports: [AuthModule],
  controllers: [PartyAssignmentsController],
  providers: [PartyAssignmentsService],
  exports: [PartyAssignmentsService],
})
export class PartyAssignmentsModule {}
