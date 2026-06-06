import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAssignmentDto, UpdateAssignmentDto } from "./party-assignments.dto";

const INCLUDE = {
  party: { select: { id: true, name: true, phone: true, city: true } },
  member: { select: { id: true, name: true, contact: true, role: true } },
};

@Injectable()
export class PartyAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateAssignmentDto) {
    const visitDays = dto.visitDays.join(",");
    // Upsert: if assignment already exists update visitDays, otherwise create
    const existing = await this.prisma.partyAssignment.findUnique({
      where: { partyId_memberId: { partyId: dto.partyId, memberId: dto.memberId } },
    });

    if (existing) {
      return this.prisma.partyAssignment.update({
        where: { id: existing.id },
        data: { visitDays },
        include: INCLUDE,
      });
    }

    return this.prisma.partyAssignment.create({
      data: { tenantId, partyId: dto.partyId, memberId: dto.memberId, visitDays },
      include: INCLUDE,
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.partyAssignment.findMany({
      where: { tenantId },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async findByMember(tenantId: string, memberId: string) {
    return this.prisma.partyAssignment.findMany({
      where: { tenantId, memberId },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAssignmentDto) {
    const assignment = await this.prisma.partyAssignment.findUnique({ where: { id } });
    if (!assignment || assignment.tenantId !== tenantId) {
      throw new NotFoundException("Assignment not found");
    }
    return this.prisma.partyAssignment.update({
      where: { id },
      data: { visitDays: dto.visitDays.join(",") },
      include: INCLUDE,
    });
  }

  async remove(tenantId: string, id: string) {
    const assignment = await this.prisma.partyAssignment.findUnique({ where: { id } });
    if (!assignment || assignment.tenantId !== tenantId) {
      throw new NotFoundException("Assignment not found");
    }
    await this.prisma.partyAssignment.delete({ where: { id } });
  }
}
