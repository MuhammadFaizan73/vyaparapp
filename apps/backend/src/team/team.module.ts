import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TeamController, TeamInviteController } from "./team.controller";
import { TeamService } from "./team.service";

@Module({
  imports: [AuthModule],
  controllers: [TeamController, TeamInviteController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
