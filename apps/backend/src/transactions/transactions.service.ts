import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTransactionDto, UpdateTransactionDto } from "./transactions.dto";
import { companyIdWhere } from "../common/company-filter.util";

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
  companyId: string | null;
  bookerId: string | null;
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
    companyId: t.companyId ?? null,
    bookerId: t.bookerId ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

export type Caller = { memberId?: string; permissions: string[] | null };

// Permissions are only enforced for the "sale" type today — other types (purchase,
// payment_in, etc.) have no comparable edit/delete permission strings yet, so there's
// nothing meaningful to check for them here. null permissions = owner/legacy token,
// unrestricted (matches the mobile client's own getPermissions() convention exactly).
function assertCanTouchSale(caller: Caller, txn: { type: string; bookerId: string | null; date: Date }, action: "edit" | "delete") {
  if (!caller.memberId || caller.permissions === null || txn.type !== "sale") return;
  const perms = caller.permissions;
  if (action === "delete") {
    if (!perms.includes("sale_delete")) {
      throw new ForbiddenException("You don't have permission to delete this invoice.");
    }
    return;
  }
  const canAll = perms.includes("sale_edit_all");
  const canOwn = perms.includes("sale_edit_own") && txn.bookerId === caller.memberId;
  if (!canAll && !canOwn) {
    throw new ForbiddenException("You don't have permission to edit this invoice.");
  }
  if (perms.includes("sale_edit_today_only")) {
    const today = new Date().toISOString().slice(0, 10);
    const txnDate = txn.date.toISOString().slice(0, 10);
    if (txnDate !== today) {
      throw new ForbiddenException("You can only edit today's invoices.");
    }
  }
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(tenantId: string, id: string): Promise<TransactionRow> {
    const row = await this.prisma.transaction.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) {
      throw new NotFoundException("Transaction not found");
    }
    return toRow(row);
  }

  async listForParty(tenantId: string, partyId: string): Promise<TransactionRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { tenantId, partyId },
      orderBy: { date: "desc" },
    });
    return rows.map(toRow);
  }

  async listAll(tenantId: string, companyId?: string): Promise<TransactionRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { tenantId, ...companyIdWhere(companyId) },
      orderBy: { date: "desc" },
      take: 200,
    });
    return rows.map(toRow);
  }

  // A date-only `to` (e.g. "2026-08-06") parses as midnight at the *start* of that
  // day — used bare as `lte`, it would exclude every transaction from later that same
  // day. Push it to the end of the day so "to today" actually includes today.
  private dateFilter(from?: string, to?: string) {
    if (!from && !to) return undefined;
    const toEndOfDay = to ? new Date(to) : undefined;
    if (toEndOfDay) toEndOfDay.setUTCHours(23, 59, 59, 999);
    return {
      ...(from && { gte: new Date(from) }),
      ...(toEndOfDay && { lte: toEndOfDay }),
    };
  }

  // take/skip/from/to are all optional and additive — omitting them preserves the exact
  // previous behavior (return every matching row) for any caller that hasn't opted in yet.
  async listByType(
    tenantId: string,
    type: string,
    opts?: { take?: number; skip?: number; from?: string; to?: string; companyId?: string },
  ): Promise<TransactionRow[]> {
    const dateFilter = this.dateFilter(opts?.from, opts?.to);
    const rows = await this.prisma.transaction.findMany({
      where: {
        tenantId, type,
        ...(dateFilter && { date: dateFilter }),
        ...companyIdWhere(opts?.companyId),
      },
      orderBy: { date: "desc" },
      ...(opts?.take !== undefined && { take: opts.take }),
      ...(opts?.skip !== undefined && { skip: opts.skip }),
    });
    return rows.map(toRow);
  }

  // Notes stores line items as JSON — either `{ items: [...] }` or a bare array, each
  // item shaped `{ name, qty, rate, unit }` (same shape mobile's parseNoteItems reads).
  // A malformed row shouldn't fail the whole request, so parse failures just yield [].
  private parseNoteItems(notes: string | null): Array<{ name?: string; rate?: number }> {
    if (!notes) return [];
    try {
      const parsed = JSON.parse(notes);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
      return items.filter((i: any) => i?.name);
    } catch {
      return [];
    }
  }

  // Last N prices a specific customer paid for a specific item, most recent first —
  // scoped by partyId (not just item name) so one customer's price history never leaks
  // into another's. Scans the party's most recent sales rather than their whole history
  // for cost; a party with no matching item within that window just returns fewer rows.
  async getLastSalePrices(
    tenantId: string,
    partyId: string,
    itemName: string,
    limit = 5,
  ): Promise<Array<{ rate: number; date: string }>> {
    const target = itemName.trim().toLowerCase();
    if (!target) return [];
    const rows = await this.prisma.transaction.findMany({
      where: { tenantId, partyId, type: "sale" },
      orderBy: { date: "desc" },
      take: 200,
    });
    const found: Array<{ rate: number; date: string }> = [];
    for (const row of rows) {
      const match = this.parseNoteItems(row.notes).find((i) => (i.name ?? "").trim().toLowerCase() === target);
      if (match?.rate) found.push({ rate: match.rate, date: row.date.toISOString() });
      if (found.length >= limit) break;
    }
    return found;
  }

  // Cheap aggregate for header stats (total / received-or-paid) — computed entirely in
  // Postgres via SUM, never by fetching and summing individual rows client-side. from/to
  // let a screen with a real date filter (e.g. Sale's "This Month") get an aggregate that
  // matches exactly what's on screen, not an all-time total.
  async summaryByType(
    tenantId: string,
    type: string,
    opts?: { from?: string; to?: string; companyId?: string },
  ): Promise<{ count: number; total: number; balance: number }> {
    const dateFilter = this.dateFilter(opts?.from, opts?.to);
    const where = { tenantId, type, ...(dateFilter && { date: dateFilter }), ...companyIdWhere(opts?.companyId) };
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

  // Sum of every transaction of this type strictly before `before` — the "opening balance"
  // a running-balance column starts from, so the visible page doesn't have to fetch (and
  // sum) the entire history just to show an accurate cumulative total per row.
  async openingBalance(tenantId: string, type: string, before: string): Promise<number> {
    const agg = await this.prisma.transaction.aggregate({
      where: { tenantId, type, date: { lt: new Date(before) } },
      _sum: { total: true },
    });
    return agg._sum.total ?? 0;
  }

  async create(tenantId: string, dto: CreateTransactionDto): Promise<TransactionRow> {
    // A client that resends a create after a slow/timed-out response (a real risk on the
    // weak connections this app targets) would otherwise land two identical invoices —
    // the client-side "disabled while saving" guard only protects against a double-tap
    // on the SAME in-flight request, not a genuinely separate retry. Return the original
    // row instead of creating a second one when the same key has already been used.
    if (dto.idempotencyKey) {
      const existing = await this.prisma.transaction.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: dto.idempotencyKey } },
      });
      if (existing) return toRow(existing);
    }
    const party = await this.prisma.party.findUnique({ where: { id: dto.partyId } });
    if (!party || party.tenantId !== tenantId) {
      throw new NotFoundException("Party not found");
    }
    try {
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
          companyId: dto.companyId ?? null,
          bookerId: dto.bookerId ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
        },
      });
      return toRow(transaction);
    } catch (err: any) {
      // Two near-simultaneous retries can both pass the findUnique check above before
      // either commits — the unique constraint catches that race; return the winner
      // instead of surfacing a 500 for what the client should see as a successful save.
      if (dto.idempotencyKey && err?.code === "P2002") {
        const existing = await this.prisma.transaction.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: dto.idempotencyKey } },
        });
        if (existing) return toRow(existing);
      }
      throw err;
    }
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

  async remove(tenantId: string, id: string, caller: Caller): Promise<void> {
    const existing = await this.prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException("Transaction not found");
    }
    assertCanTouchSale(caller, existing, "delete");
    await this.prisma.transaction.delete({ where: { id } });
  }

  async update(tenantId: string, id: string, dto: UpdateTransactionDto, caller: Caller, ipAddress?: string): Promise<TransactionRow> {
    const existing = await this.prisma.transaction.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new NotFoundException("Transaction not found");
    }
    assertCanTouchSale(caller, existing, "edit");

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
        ...(dto.companyId !== undefined && { companyId: dto.companyId }),
        ...(dto.bookerId !== undefined && { bookerId: dto.bookerId }),
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
