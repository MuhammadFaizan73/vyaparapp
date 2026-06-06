import { Module } from "@nestjs/common";
import { PartyGroupsController } from "./party-groups.controller";
import { PartyGroupsService } from "./party-groups.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PartyGroupsController],
  providers: [PartyGroupsService],
})
export class PartyGroupsModule {}
