import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AdminSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listTickets(opts: { status?: string; page: number; limit: number }) {
    const { status, page, limit } = opts;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          assignedTo: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data: tickets, total, page, limit };
  }

  async getTicket(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async createTicket(tenantId: string, subject: string, issueType: string, body: string) {
    return this.prisma.supportTicket.create({
      data: {
        tenantId,
        subject,
        issueType,
        messages: {
          create: { sender: "tenant", senderId: tenantId, body },
        },
      },
      include: { messages: true },
    });
  }

  async replyTicket(adminId: string, ticketId: string, body: string, isInternal: boolean) {
    const [message] = await Promise.all([
      this.prisma.ticketMessage.create({
        data: { ticketId, sender: "admin", senderId: adminId, body, isInternal },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "in_progress", updatedAt: new Date() },
      }),
    ]);
    return message;
  }

  async updateStatus(adminId: string, ticketId: string, status: string, assignedToId?: string) {
    const data: Record<string, unknown> = { status, updatedAt: new Date() };
    if (assignedToId !== undefined) data.assignedToId = assignedToId;

    await this.prisma.supportTicket.update({ where: { id: ticketId }, data });

    await this.audit.log({
      adminId,
      action: "update_ticket_status",
      targetType: "ticket",
      targetId: ticketId,
      meta: { status },
    });
  }
}
