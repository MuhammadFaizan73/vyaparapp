import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PartyGroupsService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.partyGroup.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  create(tenantId: string, name: string) {
    return this.prisma.partyGroup.create({
      data: { tenantId, name: name.trim() },
    });
  }

  remove(tenantId: string, id: string) {
    return this.prisma.partyGroup.deleteMany({ where: { id, tenantId } });
  }
}
