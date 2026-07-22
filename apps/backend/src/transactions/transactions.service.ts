import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTransactionDto, UpdateTransactionDto } from "./transactions.dto";

export type TransactionRow = {
  id: string;
  partyId: string;
  tenantId: string;
  type: string;
  number: string | null;
  date: string;
  total: number;
  balance: number;
  notes: string | null;
  createdAt: string;
};

export type HistoryRow = {
  id: string;
  changes: string[];
  ipAddress: string | null;
  createdAt: string;
};

function toRow(t: any): TransactionRow {
  return {
    id: t.id,
    partyId: t.partyId,
    tenantId: t.tenantId,
    type: t.type,
    number: t.number ?? null,
    date: t.date.toISOString(),
    total: t.total,
    balance: t.balance,
    notes: t.notes ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForParty(tenantId: string, partyId: string): Promise<TransactionRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { tenantId, partyId },
      orderBy: { date: "desc" },
    });
    return rows.map(toRow);
  }

  async listAll(tenantId: string): Promise<TransactionRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { tenantId },
      orderBy: { date: "desc" },
      take: 200,
    });
    return rows.map(toRow);
  }

  private dateFilter(from?: string, to?: string) {
    return from || to
      ? { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) }
      : undefined;
  }

  // take/skip/from/to are all optional and additive — omitting them preserves the exact
  // previous behavior (return every matching row) for any caller that hasn't opted in yet.
  async listByType(
    tenantId: string,
    type: string,
    opts?: { take?: number; skip?: number; from?: string; to?: string },
  ): Promise<TransactionRow[]> {
    const dateFilter = this.dateFilter(opts?.from, opts?.to);
    const rows = await this.prisma.transaction.findMany({
      where: { tenantId, type, ...(dateFilter && { date: dateFilter }) },
      orderBy: { date: "desc" },
      ...(opts?.take !== undefined && { take: opts.take }),
      ...(opts?.skip !== undefined && { skip: opts.skip }),
    });
    return rows.map(toRow);
  }

  // Cheap aggregate for header stats (total / received-or-paid) — computed entirely in
  // Postgres via SUM, never by fetching and summing individual rows client-side. from/to
  // let a screen with a real date filter (e.g. Sale's "This Month") get an aggregate that
  // matches exactly what's on screen, not an all-time total.
  async summaryByType(
    tenantId: string,
    type: string,
    opts?: { from?: string; to?: string },
  ): Promise<{ count: number; total: number; balance: number }> {
    const dateFilter = this.dateFilter(opts?.from, opts?.to);
    const where = { tenantId, type, ...(dateFilter && { date: dateFilter }) };
    const [agg, count] = await Promise.all([
      this.prisma.transaction.aggregate({ where, _sum: { total: true, balance: true } }),
      this.prisma.transaction.count({ where }),
    ]);
    return {
      count,
      total: agg._sum.total ?? 0,
      balance: agg._sum.balance ?? 0,
    };
  }

  async create(tenantId: string, dto: CreateTransactionDto): Promise<TransactionRow> {
    const party = await this.prisma.party.findUnique({ where: { id: dto.partyId } });
    if (!party || party.tenantId !== tenantId) {
      throw new NotFoundException("Party not found");
    }
    const transaction = await this.prisma.transaction.create({
      data: {
        tenantId,
        partyId: dto.partyId,
        type: dto.type,
        number: dto.number ?? null,
        date: dto.date ? new Date(dto.date) : new Date(),
        total: dto.total,
        balance: dto.balance,
        notes: dto.notes ?? null,
      },
    });
    return toRow(transaction);
  }

  async getHistory(tenantId: string, transactionId: string): Promise<HistoryRow[]> {
    const rows = await this.prisma.transactionHistory.findMany({
      where: { tenantId, transactionId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      changes: JSON.parse(r.changes) as string[],
      ipAddress: r.ipAddress ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException("Transaction not found");
    }
    await this.prisma.transaction.delete({ where: { id } });
  }

  async update(tenantId: string, id: string, dto: UpdateTransactionDto, ipAddress?: string): Promise<TransactionRow> {
    const existing = await this.prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException("Transaction not found");
    }

    /* Build human-readable diff */
    const changes: string[] = [];
    if (dto.total !== undefined && dto.total !== existing.total) {
      changes.push(`Total changed from ${existing.total} to ${dto.total}`);
    }
    if (dto.balance !== undefined && dto.balance !== existing.balance) {
      changes.push(`Balance changed from ${existing.balance} to ${dto.balance}`);
    }
    if (dto.date !== undefined) {
      const oldDate = existing.date.toISOString().slice(0, 10);
      const newDate = new Date(dto.date).toISOString().slice(0, 10);
      if (oldDate !== newDate) changes.push(`Date changed from ${oldDate} to ${newDate}`);
    }
    if (dto.notes !== undefined && dto.notes !== existing.notes) {
      try {
        const oldParsed = existing.notes ? JSON.parse(existing.notes) : {};
        const newParsed = JSON.parse(dto.notes);
        const oldItems: any[] = Array.isArray(oldParsed) ? oldParsed : (oldParsed.items ?? []);
        const newItems: any[] = Array.isArray(newParsed) ? newParsed : (newParsed.items ?? []);
        const oldNames = new Set(oldItems.map((i: any) => i.name));
        for (const item of newItems) {
          if (!oldNames.has(item.name)) {
            changes.push(`Item ${item.name} added (qty: ${item.qty}, taxable value: Rs${(item.qty * item.rate).toFixed(0)})`);
          } else {
            const old = oldItems.find((o: any) => o.name === item.name);
            if (old && old.qty !== item.qty) {
              changes.push(`Item ${item.name} qty changed from ${old.qty} to ${item.qty}`);
            }
            if (old && old.rate !== item.rate) {
              changes.push(`Item ${item.name} price changed from Rs${old.rate} to Rs${item.rate}`);
            }
          }
        }
        const newNames = new Set(newItems.map((i: any) => i.name));
        for (const item of oldItems) {
          if (!newNames.has(item.name)) {
            changes.push(`Item ${item.name} removed`);
          }
        }
      } catch { /* notes not item JSON — generic diff */ }
    }

    const transaction = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.partyId !== undefined && { partyId: dto.partyId }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.total !== undefined && { total: dto.total }),
        ...(dto.balance !== undefined && { balance: dto.balance }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    /* Persist history if anything changed */
    if (changes.length > 0) {
      await this.prisma.transactionHistory.create({
        data: { transactionId: id, tenantId, changes: JSON.stringify(changes), ipAddress: ipAddress ?? null },
      });
    }

    return toRow(transaction);
  }
}
