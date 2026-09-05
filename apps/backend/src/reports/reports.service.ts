import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { companyIdWhere, parseCompanyIds } from '../common/company-filter.util';
import { toBaseQty, type ItemUnitInfo } from '../common/unit-qty.util';

// ─── helpers ─────────────────────────────────────────────────────────────────

// Notes have two shapes in the wild: a bare array of line items (older sales, before
// paymentType was tracked), or `{ items: [...], paymentType, ... }` (current format,
// carries the line items alongside metadata like the actual payment type/Credit-vs-Cash
// mode). Both parsers below handle either shape so historical rows keep working.
function parseItems(
  notes: string | null,
): Array<{ name: string; qty: number; rate: number; mrp?: number; unit?: string }> {
  if (!notes) return [];
  try {
    const p = JSON.parse(notes);
    if (Array.isArray(p)) return p;
    return Array.isArray(p?.items) ? p.items : [];
  } catch {
    return [];
  }
}

function parseNoteObj(notes: string | null): Record<string, any> {
  if (!notes) return {};
  try {
    const p = JSON.parse(notes);
    return Array.isArray(p) ? {} : (p ?? {});
  } catch {
    return {};
  }
}

// Decomposes a base-unit quantity back into the item's largest-to-smallest units for
// display — 8.15 Box (conversionRate 20) becomes ["8 Box", "3 Piece"] instead of a bare
// decimal that hides what a fractional box even means.
function formatQtyParts(baseQty: number, item: ItemUnitInfo): string[] {
  const unit = item.unit || 'pcs';
  let remaining = baseQty;
  const parts: string[] = [];

  const tertiaryRate = parseFloat(item.tertiaryConversionRate ?? '') || 0;
  if (item.tertiaryUnit && tertiaryRate > 0) {
    const count = Math.floor(remaining / tertiaryRate + 1e-9);
    if (count > 0) { parts.push(`${count} ${item.tertiaryUnit}`); remaining -= count * tertiaryRate; }
  }

  const wholeBase = Math.floor(remaining + 1e-9);
  const fracBase = remaining - wholeBase;
  const secondaryRate = parseFloat(item.conversionRate ?? '') || 0;

  if (item.secondaryUnit && secondaryRate > 0) {
    if (wholeBase > 0) parts.push(`${wholeBase} ${unit}`);
    const secCount = Math.round(fracBase * secondaryRate);
    if (secCount > 0) parts.push(`${secCount} ${item.secondaryUnit}`);
  } else if (remaining !== 0 || parts.length === 0) {
    parts.push(`${Math.round(remaining * 100) / 100} ${unit}`);
  }

  return parts.length ? parts : [`0 ${unit}`];
}

// Report tables show at most two quantity columns — larger unit and smaller unit — rather
// than one combined string, since a fixed table can't grow a column per distinct unit name.
// A rare 3rd tier (tertiary + base + secondary all present) folds into the second column.
function formatQtySplit(baseQty: number, item: ItemUnitInfo): { qtyLarger: string; qtySmaller: string } {
  const [first, ...rest] = formatQtyParts(baseQty, item);
  return { qtyLarger: first, qtySmaller: rest.join(' ') };
}

function txnStatus(total: number, balance: number): string {
  if (balance <= 0) return 'paid';
  if (balance < total) return 'partial';
  return 'unpaid';
}

function parseDate(d?: string): Date | undefined {
  if (!d) return undefined;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? undefined : dt;
}

// This app has one country of users, and every stored `date` is a UTC instant for *Pakistan*
// midnight — but `d.getFullYear()/getMonth()/getDate()` read the calendar day in the *server
// process's* timezone (Railway's container, not necessarily Pakistan), so a report's day
// boundary could land up to several hours off from what "that day" means in Pakistan. Reading
// the day via Intl with an explicit Asia/Karachi zone, then anchoring the boundary back to
// that same zone with an explicit +05:00 offset, makes this correct regardless of server TZ.
const PK_TZ = 'Asia/Karachi';
function pkDateParts(d: Date): { y: number; m: number; day: number } {
  const [y, m, day] = new Intl.DateTimeFormat('en-CA', { timeZone: PK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d).split('-').map(Number);
  return { y, m, day };
}
function startOfDay(d: Date): Date {
  const { y, m, day } = pkDateParts(d);
  return new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+05:00`);
}

function endOfDay(d: Date): Date {
  const { y, m, day } = pkDateParts(d);
  return new Date(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999+05:00`);
}

function buildDateFilter(from?: string, to?: string) {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (!fromDate && !toDate) return undefined;
  const filter: Record<string, Date> = {};
  if (fromDate) filter.gte = startOfDay(fromDate);
  if (toDate) filter.lte = endOfDay(toDate);
  return filter;
}

// ─── service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Sale Report ─────────────────────────────────────────────────────────────

  async getSaleReport(tenantId: string, from?: string, to?: string, status?: string, partyId?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'credit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(partyId ? { partyId } : {}),
        ...companyIdWhere(companyId),
      },
      include: { party: true, booker: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    let totalAmount = 0;
    let received = 0;
    let balanceSum = 0;
    let creditNoteTotal = 0;

    const transactions = txns.map((t) => {
      const noteObj = parseNoteObj(t.notes);
      const paymentType: string = noteObj.paymentType ?? 'Cash';

      if (t.type === 'sale') {
        totalAmount += t.total;
        received += t.total - t.balance;
        balanceSum += t.balance;
      } else if (t.type === 'credit_note') {
        creditNoteTotal += t.total;
      }

      return {
        date: t.date.toISOString(),
        invoiceNo: t.number ?? '',
        partyName: t.party.name,
        type: t.type,
        paymentType,
        amount: t.total,
        balance: t.balance,
        bookerName: t.booker?.name ?? '',
        status: txnStatus(t.total, t.balance),
      };
    });

    const filtered = status ? transactions.filter((t) => t.status === status) : transactions;

    return {
      summary: {
        totalAmount,
        received,
        balance: balanceSum,
        creditNoteTotal,
        vsLastMonth: 100,
      },
      transactions: filtered,
    };
  }

  // ── Purchase Report ─────────────────────────────────────────────────────────

  async getPurchaseReport(tenantId: string, from?: string, to?: string, status?: string, partyId?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['purchase', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(partyId ? { partyId } : {}),
        ...companyIdWhere(companyId),
      },
      include: { party: true },
      orderBy: { date: 'desc' },
    });

    let total = 0;
    let paid = 0;
    let unpaid = 0;
    let debitNoteTotal = 0;

    const transactions = txns.map((t) => {
      const noteObj = parseNoteObj(t.notes);
      const paymentType: string = noteObj.paymentType ?? 'Cash';

      if (t.type === 'purchase') {
        total += t.total;
        paid += t.total - t.balance;
        unpaid += t.balance;
      } else if (t.type === 'debit_note') {
        debitNoteTotal += t.total;
      }

      return {
        date: t.date.toISOString(),
        invoiceNo: t.number ?? '',
        partyName: t.party.name,
        type: t.type,
        paymentType,
        amount: t.total,
        balance: t.balance,
        status: txnStatus(t.total, t.balance),
      };
    });

    const filtered = status ? transactions.filter((t) => t.status === status) : transactions;

    return {
      summary: { paid, unpaid, total, debitNoteTotal },
      transactions: filtered,
    };
  }

  // ── Day Book ────────────────────────────────────────────────────────────────

  async getDayBook(tenantId: string, date?: string, companyId?: string) {
    const target = date ? (parseDate(date) ?? new Date()) : new Date();
    const dayStart = startOfDay(target);
    const dayEnd = endOfDay(target);

    const txns = await this.prisma.transaction.findMany({
      where: { tenantId, date: { gte: dayStart, lte: dayEnd }, ...companyIdWhere(companyId) },
      include: { party: true },
      orderBy: { date: 'asc' },
    });

    const moneyInTypes = new Set(['sale', 'payment_in', 'credit_note', 'opening_balance']);
    const moneyOutTypes = new Set(['purchase', 'payment_out', 'debit_note', 'expense']);

    let totalMoneyIn = 0;
    let totalMoneyOut = 0;

    const transactions = txns.map((t) => {
      const noteObj = parseNoteObj(t.notes);
      const paymentType: string = noteObj.paymentType ?? 'Cash';
      const moneyIn = moneyInTypes.has(t.type) ? t.total : 0;
      const moneyOut = moneyOutTypes.has(t.type) ? t.total : 0;

      totalMoneyIn += moneyIn;
      totalMoneyOut += moneyOut;

      return {
        name: t.party.name,
        refNo: t.number ?? '',
        type: t.type,
        paymentType,
        total: t.total,
        moneyIn,
        moneyOut,
      };
    });

    return {
      date: dayStart.toISOString(),
      transactions,
      totalMoneyIn,
      totalMoneyOut,
      netAmount: totalMoneyIn - totalMoneyOut,
    };
  }

  // ── All Transactions ────────────────────────────────────────────────────────

  async getAllTransactions(
    tenantId: string,
    from?: string,
    to?: string,
    txnType?: string,
    paymentType?: string,
    status?: string,
    partyId?: string,
    companyId?: string,
    bookerId?: string,
  ) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        ...(txnType ? { type: txnType } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(partyId ? { partyId } : {}),
        ...(bookerId ? { bookerId } : {}),
        ...companyIdWhere(companyId),
      },
      include: { party: true, booker: true },
      orderBy: { date: 'desc' },
    });

    let filtered = txns;
    if (paymentType) {
      filtered = txns.filter((t) => {
        const obj = parseNoteObj(t.notes);
        return (obj.paymentType ?? 'Cash') === paymentType;
      });
    }

    const transactions = filtered.map((t, i) => {
      const noteObj = parseNoteObj(t.notes);
      const pt: string = noteObj.paymentType ?? 'Cash';
      return {
        index: i + 1,
        date: t.date.toISOString(),
        refNo: t.number ?? '',
        partyName: t.party.name,
        category: '',
        type: t.type,
        total: t.total,
        received: t.total - t.balance,
        balance: t.balance,
        status: txnStatus(t.total, t.balance),
        paymentType: pt,
        bookerName: t.booker?.name ?? '',
      };
    });

    const statusFiltered = status ? transactions.filter((t) => t.status === status) : transactions;

    return { transactions: statusFiltered };
  }

  // ── Profit & Loss ───────────────────────────────────────────────────────────

  async getProfitAndLoss(tenantId: string, from?: string, to?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);
    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
    });

    let saleTotal = 0;
    let creditNoteTotal = 0;
    let purchaseTotal = 0;
    let debitNoteTotal = 0;
    let expenseTotal = 0;

    for (const t of txns) {
      switch (t.type) {
        case 'sale': saleTotal += t.total; break;
        case 'credit_note': creditNoteTotal += t.total; break;
        case 'purchase': purchaseTotal += t.total; break;
        case 'debit_note': debitNoteTotal += t.total; break;
        case 'expense': expenseTotal += t.total; break;
      }
    }

    // All items for stock valuation
    const items = await this.prisma.item.findMany({ where: { tenantId, ...companyIdWhere(companyId) } });

    // Opening stock = items that existed before `from` valued at purchasePrice
    // We approximate by using all items' openingStock field
    let openingStockValue = 0;
    for (const item of items) {
      const pp = item.purchasePrice ?? 0;
      openingStockValue += item.openingStock * pp;
    }

    // Closing stock: current stock qty * purchasePrice
    // Current stock requires reading all purchase/sale txns up to `to` (or now)
    const allTxns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['purchase', 'sale', 'credit_note', 'debit_note'] },
        ...(toDate ? { date: { lte: endOfDay(toDate) } } : {}),
        ...companyIdWhere(companyId),
      },
    });

    const stockMap = new Map<string, number>(); // itemName -> qty
    for (const item of items) {
      stockMap.set(item.name, item.openingStock);
    }

    for (const t of allTxns) {
      const lineItems = parseItems(t.notes);
      for (const li of lineItems) {
        const current = stockMap.get(li.name) ?? 0;
        if (t.type === 'purchase' || t.type === 'credit_note') {
          stockMap.set(li.name, current + (li.qty ?? 0));
        } else if (t.type === 'sale' || t.type === 'debit_note') {
          stockMap.set(li.name, current - (li.qty ?? 0));
        }
      }
    }

    let closingStockValue = 0;
    for (const item of items) {
      const qty = stockMap.get(item.name) ?? item.openingStock;
      const pp = item.purchasePrice ?? 0;
      closingStockValue += qty * pp;
    }

    const grossProfit =
      saleTotal - creditNoteTotal - purchaseTotal + debitNoteTotal - openingStockValue + closingStockValue;
    const netProfit = grossProfit - expenseTotal;

    return {
      from: fromDate?.toISOString() ?? null,
      to: toDate?.toISOString() ?? null,
      viewType: 'godigi',
      saleTotal,
      creditNoteTotal,
      purchaseTotal,
      debitNoteTotal,
      expenseTotal,
      openingStockValue,
      closingStockValue,
      grossProfit,
      netProfit,
    };
  }

  // ── Cash Flow ───────────────────────────────────────────────────────────────

  async getCashFlow(tenantId: string, from?: string, to?: string, companyId?: string) {
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    const dateFilter = buildDateFilter(from, to);

    // Opening cash: payment_in before from minus payment_out before from + opening_balance totals
    let openingCash = 0;
    if (fromDate) {
      const beforeFrom = startOfDay(fromDate);
      const preTxns = await this.prisma.transaction.findMany({
        where: {
          tenantId,
          type: { in: ['payment_in', 'payment_out', 'opening_balance'] },
          date: { lt: beforeFrom },
          ...companyIdWhere(companyId),
        },
      });
      for (const t of preTxns) {
        if (t.type === 'payment_in' || t.type === 'opening_balance') {
          openingCash += t.total;
        } else if (t.type === 'payment_out') {
          openingCash -= t.total;
        }
      }
    }

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase', 'payment_in', 'payment_out', 'expense', 'opening_balance'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
      include: { party: true },
      orderBy: { date: 'asc' },
    });

    let totalCashIn = 0;
    let totalCashOut = 0;
    let runningBalance = openingCash;

    const cashInTypes = new Set(['sale', 'payment_in', 'opening_balance']);
    const cashOutTypes = new Set(['purchase', 'payment_out', 'expense']);

    const transactions = txns.map((t) => {
      const noteObj = parseNoteObj(t.notes);
      const cashIn = cashInTypes.has(t.type) ? t.total : 0;
      const cashOut = cashOutTypes.has(t.type) ? t.total : 0;
      runningBalance += cashIn - cashOut;
      totalCashIn += cashIn;
      totalCashOut += cashOut;

      return {
        date: t.date.toISOString(),
        refNo: t.number ?? '',
        name: t.party.name,
        category: noteObj.category ?? '',
        type: t.type,
        cashIn,
        cashOut,
        runningBalance,
      };
    });

    return {
      openingCash,
      transactions,
      totalCashIn,
      totalCashOut,
      closingCash: openingCash + totalCashIn - totalCashOut,
    };
  }

  // ── Party Statement ─────────────────────────────────────────────────────────

  async getPartyStatement(tenantId: string, from?: string, to?: string, partyId?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        ...(partyId ? { partyId } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
      include: { party: true },
      orderBy: { date: 'asc' },
    });

    let totalSale = 0;
    let totalPurchase = 0;
    let totalMoneyIn = 0;
    let totalMoneyOut = 0;
    let receivableBalance = 0;
    let payableBalance = 0;

    const transactions = txns.map((t) => {
      const noteObj = parseNoteObj(t.notes);
      const paymentType: string = noteObj.paymentType ?? 'Cash';
      const received = t.total - t.balance;
      const txnBalance = t.balance;

      // Running receivable: sale invoices track their own outstanding `balance` reliably
      // (payment_in already reduces it when applied), so this just accumulates that.
      // Running payable: purchase invoices don't — the Purchase Report always shows every
      // invoice as 100% unpaid regardless of what's actually paid, while real supplier
      // payments only show up as payment_out — so payable nets purchase totals against
      // payment_out cash directly (see the identical fix in parties.service.ts's list()).
      if (t.type === 'sale' || t.type === 'credit_note') {
        totalSale += t.total;
        receivableBalance += txnBalance;
      } else if (t.type === 'purchase') {
        totalPurchase += t.total;
        payableBalance += t.total;
      } else if (t.type === 'debit_note') {
        totalPurchase += t.total;
        payableBalance -= t.total;
      } else if (t.type === 'payment_in') {
        totalMoneyIn += t.total;
      } else if (t.type === 'payment_out') {
        totalMoneyOut += t.total;
        payableBalance -= t.total;
      }

      return {
        date: t.date.toISOString(),
        type: t.type,
        refNo: t.number ?? '',
        paymentType,
        total: t.total,
        received,
        txnBalance,
        receivableBalance,
        payableBalance,
        partyName: t.party.name,
      };
    });

    return {
      transactions,
      summary: {
        totalSale,
        totalPurchase,
        totalMoneyIn,
        totalMoneyOut,
        totalReceivable: Math.max(0, receivableBalance),
        totalPayable: Math.max(0, payableBalance),
      },
    };
  }

  // ── All Parties ─────────────────────────────────────────────────────────────

  async getAllParties(tenantId: string, companyId?: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);
    const allParties = await this.prisma.party.findMany({
      where: { tenantId, isSystem: false },
      include: {
        transactions: {
          where: { ...companyIdWhere(companyId), ...(dateFilter ? { date: dateFilter } : {}) },
        },
      },
    });
    // Same scoping as parties.service.ts's list(): a party belongs under a company filter
    // if it's tagged directly (companyId), or has at least one transaction scoped to that
    // company — a party tagged to the company but with only an opening balance (no
    // transaction rows) was previously dropped here even though it legitimately belongs.
    const filterIds = parseCompanyIds(companyId);
    const parties = filterIds.length
      ? allParties.filter(
          (p) => p.transactions.length > 0 || (p.companyId && filterIds.includes(p.companyId)),
        )
      : allParties;

    let totalReceivable = 0;
    let totalPayable = 0;

    const result = parties.map((p, i) => {
      let receivableBalance = 0;
      let purchaseTotal = 0;
      let paymentOutTotal = 0;

      // Sale invoices track their own outstanding `balance` reliably (payment_in already
      // reduces it when applied). Purchase invoices don't for this data — the Purchase
      // Report always shows every invoice as 100% unpaid regardless of what's actually
      // been paid, while real supplier payments only show up in the payment_out cash
      // ledger — so payable is netted against actual cash paid per supplier instead
      // (see the identical fix in parties.service.ts's list()).
      for (const t of p.transactions) {
        if (t.type === 'sale' || t.type === 'credit_note') {
          receivableBalance += t.balance;
        } else if (t.type === 'purchase') {
          purchaseTotal += t.total;
        } else if (t.type === 'debit_note') {
          purchaseTotal -= t.total;
        } else if (t.type === 'payment_out') {
          paymentOutTotal += t.total;
        }
      }
      let payableBalance = Math.max(0, purchaseTotal - paymentOutTotal);

      // Opening balance affects receivable/payable
      if (p.openingBalance > 0) receivableBalance += p.openingBalance;
      else if (p.openingBalance < 0) payableBalance += Math.abs(p.openingBalance);

      const rec = Math.max(0, receivableBalance);
      const pay = Math.max(0, payableBalance);
      totalReceivable += rec;
      totalPayable += pay;

      return {
        index: i + 1,
        name: p.name,
        email: p.email ?? '',
        phone: p.phone ?? '',
        receivableBalance: rec,
        payableBalance: pay,
        creditLimit: p.creditLimit ?? 0,
        partyType: p.partyType,
      };
    });

    return { parties: result, totalReceivable, totalPayable };
  }

  // ── Party Report By Item ────────────────────────────────────────────────────
  // Broken down per item within each party, not a single blended quantity — summing
  // "2 Carton" of one item with "40 Piece" of another into one raw number is meaningless
  // once items have different units, so each item gets its own qty (in its own units).

  async getPartyReportByItem(tenantId: string, from?: string, to?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const [txns, items] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          tenantId,
          type: { in: ['sale', 'purchase', 'credit_note', 'debit_note'] },
          ...(dateFilter ? { date: dateFilter } : {}),
          ...companyIdWhere(companyId),
        },
        include: { party: true },
      }),
      this.prisma.item.findMany({ where: { tenantId, ...companyIdWhere(companyId) } }),
    ]);

    const itemByName = new Map<string, ItemUnitInfo>();
    for (const it of items) itemByName.set(it.name.trim().toLowerCase(), it);

    type ItemBucket = {
      itemName: string; unitLabel: string; matchedItem?: ItemUnitInfo;
      saleQty: number; saleAmount: number; purchaseQty: number; purchaseAmount: number;
    };
    const partyMap = new Map<string, { partyName: string; items: Map<string, ItemBucket> }>();

    for (const t of txns) {
      const partyName = t.party.name;
      if (!partyMap.has(partyName)) partyMap.set(partyName, { partyName, items: new Map() });
      const partyEntry = partyMap.get(partyName)!;

      for (const li of parseItems(t.notes)) {
        const itemName = (li.name ?? '').trim();
        if (!itemName) continue;
        const matched = itemByName.get(itemName.toLowerCase());
        // Unmatched items (no catalog entry) can't be unit-converted, so they're kept
        // separate per raw unit rather than silently summed across incompatible units.
        const bucketKey = matched ? itemName.toLowerCase() : `${itemName.toLowerCase()}__${(li.unit ?? '').trim().toLowerCase()}`;

        if (!partyEntry.items.has(bucketKey)) {
          partyEntry.items.set(bucketKey, {
            itemName, unitLabel: li.unit ?? '', matchedItem: matched,
            saleQty: 0, saleAmount: 0, purchaseQty: 0, purchaseAmount: 0,
          });
        }
        const bucket = partyEntry.items.get(bucketKey)!;
        const qty = li.qty ?? 0;
        const baseQty = matched ? toBaseQty(qty, li.unit, matched) : qty;
        const amount = qty * (li.rate ?? 0);

        if (t.type === 'sale') { bucket.saleQty += baseQty; bucket.saleAmount += amount; }
        else if (t.type === 'purchase') { bucket.purchaseQty += baseQty; bucket.purchaseAmount += amount; }
        else if (t.type === 'credit_note') { bucket.saleQty -= baseQty; bucket.saleAmount -= amount; }
        else if (t.type === 'debit_note') { bucket.purchaseQty -= baseQty; bucket.purchaseAmount -= amount; }
      }
    }

    const parties = Array.from(partyMap.values()).map((p) => {
      const itemRows = Array.from(p.items.values()).map((b) => {
        const sale = b.matchedItem
          ? formatQtySplit(b.saleQty, b.matchedItem)
          : { qtyLarger: `${Math.round(b.saleQty * 100) / 100} ${b.unitLabel || 'pcs'}`, qtySmaller: '' };
        const purchase = b.matchedItem
          ? formatQtySplit(b.purchaseQty, b.matchedItem)
          : { qtyLarger: `${Math.round(b.purchaseQty * 100) / 100} ${b.unitLabel || 'pcs'}`, qtySmaller: '' };
        return {
          itemName: b.itemName,
          saleQtyLarger: sale.qtyLarger,
          saleQtySmaller: sale.qtySmaller,
          saleAmount: b.saleAmount,
          purchaseQtyLarger: purchase.qtyLarger,
          purchaseQtySmaller: purchase.qtySmaller,
          purchaseAmount: b.purchaseAmount,
        };
      });
      return {
        partyName: p.partyName,
        items: itemRows,
        saleAmount: itemRows.reduce((s, r) => s + r.saleAmount, 0),
        purchaseAmount: itemRows.reduce((s, r) => s + r.purchaseAmount, 0),
      };
    });

    const total = parties.reduce(
      (acc, p) => ({ saleAmount: acc.saleAmount + p.saleAmount, purchaseAmount: acc.purchaseAmount + p.purchaseAmount }),
      { saleAmount: 0, purchaseAmount: 0 },
    );

    return { parties, total };
  }

  // ── Item Report By Party ────────────────────────────────────────────────────
  // Same shape as Party Report By Item, grouped the other way: per item, sale/purchase
  // qty and amount attributed from each transaction's own line items (not the whole
  // transaction total, since one invoice can cover several items).

  async getItemReportByParty(tenantId: string, from?: string, to?: string, companyId?: string, bookerId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const [txns, items] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          tenantId,
          type: { in: ['sale', 'purchase', 'credit_note', 'debit_note'] },
          ...(dateFilter ? { date: dateFilter } : {}),
          ...(bookerId ? { bookerId } : {}),
          ...companyIdWhere(companyId),
        },
      }),
      this.prisma.item.findMany({ where: { tenantId, ...companyIdWhere(companyId) } }),
    ]);

    const itemByName = new Map<string, ItemUnitInfo>();
    for (const it of items) itemByName.set(it.name.trim().toLowerCase(), it);

    type ItemBucket = {
      itemName: string; unitLabel: string; matchedItem?: ItemUnitInfo;
      saleQty: number; saleAmount: number; purchaseQty: number; purchaseAmount: number;
    };
    const itemMap = new Map<string, ItemBucket>();

    for (const t of txns) {
      for (const li of parseItems(t.notes)) {
        const itemName = (li.name ?? '').trim();
        if (!itemName) continue;
        const matched = itemByName.get(itemName.toLowerCase());
        // Unmatched items (no catalog entry) can't be unit-converted, so they're kept
        // separate per raw unit rather than silently summed across incompatible units.
        const bucketKey = matched ? itemName.toLowerCase() : `${itemName.toLowerCase()}__${(li.unit ?? '').trim().toLowerCase()}`;

        if (!itemMap.has(bucketKey)) {
          itemMap.set(bucketKey, {
            itemName, unitLabel: li.unit ?? '', matchedItem: matched,
            saleQty: 0, saleAmount: 0, purchaseQty: 0, purchaseAmount: 0,
          });
        }
        const bucket = itemMap.get(bucketKey)!;
        const qty = li.qty ?? 0;
        const baseQty = matched ? toBaseQty(qty, li.unit, matched) : qty;
        const amount = qty * (li.rate ?? 0);

        if (t.type === 'sale') { bucket.saleQty += baseQty; bucket.saleAmount += amount; }
        else if (t.type === 'purchase') { bucket.purchaseQty += baseQty; bucket.purchaseAmount += amount; }
        else if (t.type === 'credit_note') { bucket.saleQty -= baseQty; bucket.saleAmount -= amount; }
        else if (t.type === 'debit_note') { bucket.purchaseQty -= baseQty; bucket.purchaseAmount -= amount; }
      }
    }

    const itemRows = Array.from(itemMap.values()).map((b) => {
      const sale = b.matchedItem
        ? formatQtySplit(b.saleQty, b.matchedItem)
        : { qtyLarger: `${Math.round(b.saleQty * 100) / 100} ${b.unitLabel || 'pcs'}`, qtySmaller: '' };
      const purchase = b.matchedItem
        ? formatQtySplit(b.purchaseQty, b.matchedItem)
        : { qtyLarger: `${Math.round(b.purchaseQty * 100) / 100} ${b.unitLabel || 'pcs'}`, qtySmaller: '' };
      return {
        itemName: b.itemName,
        saleQtyLarger: sale.qtyLarger,
        saleQtySmaller: sale.qtySmaller,
        saleAmount: b.saleAmount,
        purchaseQtyLarger: purchase.qtyLarger,
        purchaseQtySmaller: purchase.qtySmaller,
        purchaseAmount: b.purchaseAmount,
      };
    });

    const total = itemRows.reduce(
      (acc, i) => ({
        saleAmount: acc.saleAmount + i.saleAmount,
        purchaseAmount: acc.purchaseAmount + i.purchaseAmount,
      }),
      { saleAmount: 0, purchaseAmount: 0 },
    );

    return { items: itemRows, total };
  }

  // ── Sale/Purchase By Party ──────────────────────────────────────────────────

  async getSalePurchaseByParty(tenantId: string, from?: string, to?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
      include: { party: true },
    });

    const partyMap = new Map<string, { partyName: string; saleAmount: number; purchaseAmount: number }>();

    for (const t of txns) {
      const name = t.party.name;
      if (!partyMap.has(name)) {
        partyMap.set(name, { partyName: name, saleAmount: 0, purchaseAmount: 0 });
      }
      const entry = partyMap.get(name)!;
      if (t.type === 'sale') entry.saleAmount += t.total;
      else if (t.type === 'purchase') entry.purchaseAmount += t.total;
    }

    const parties = Array.from(partyMap.values());
    const totalSaleAmount = parties.reduce((s, p) => s + p.saleAmount, 0);
    const totalPurchaseAmount = parties.reduce((s, p) => s + p.purchaseAmount, 0);

    return { parties, totalSaleAmount, totalPurchaseAmount };
  }

  // ── Sale/Purchase By Party Group ────────────────────────────────────────────

  async getSalePurchaseByPartyGroup(tenantId: string, from?: string, to?: string, companyId?: string) {
    const { totalSaleAmount, totalPurchaseAmount } = await this.getSalePurchaseByParty(tenantId, from, to, companyId);
    return {
      groups: [
        {
          groupName: 'General',
          saleAmount: totalSaleAmount,
          purchaseAmount: totalPurchaseAmount,
        },
      ],
    };
  }

  // ── Stock Helpers ───────────────────────────────────────────────────────────

  // Converts a line-item quantity into `unit`-equivalent terms using the item's configured
  // tertiaryUnit / unit / secondaryUnit / conversionRate / tertiaryConversionRate.
  // Matches this business's real unit hierarchy (biggest to smallest): tertiaryUnit (e.g.
  // Carton) > unit (e.g. Box — the item's normal stocking unit, what openingStock/salePrice
  // are denominated in) > secondaryUnit (e.g. Pieces — a finer subdivision of unit). So
  // 1 tertiaryUnit = tertiaryConversionRate unit, and 1 unit = conversionRate secondaryUnit.
  // A line item recorded in secondaryUnit or tertiaryUnit must be rescaled into `unit` terms
  // before it can be summed against other line items — otherwise a Carton sale and a Piece
  // purchase get added 1-for-1, which is how stock quantities went wrong in the first place.
  private buildUnitConverter(item: {
    unit?: string | null;
    secondaryUnit?: string | null;
    conversionRate?: string | null;
    tertiaryUnit?: string | null;
    tertiaryConversionRate?: string | null;
  }): (qty: number, lineUnit?: string | null) => number {
    const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();
    const secondaryUnit = norm(item.secondaryUnit);
    const tertiaryUnit = norm(item.tertiaryUnit);
    const conversionRate = item.conversionRate ? Number(item.conversionRate) : null; // 1 unit = conversionRate secondaryUnit
    const tertiaryConversionRate = item.tertiaryConversionRate ? Number(item.tertiaryConversionRate) : null; // 1 tertiaryUnit = tertiaryConversionRate unit

    return (qty: number, lineUnit?: string | null) => {
      const u = norm(lineUnit);
      if (!u) return qty;
      if (tertiaryUnit && u === tertiaryUnit && tertiaryConversionRate) {
        return qty * tertiaryConversionRate; // Carton -> Box: scale up
      }
      if (secondaryUnit && u === secondaryUnit && conversionRate) {
        return qty / conversionRate; // Pieces -> Box: scale down
      }
      // Matches `unit` itself, or an unrecognized unit string — treat as already
      // expressed in `unit` terms rather than silently dropping the quantity.
      return qty;
    };
  }

  private async computeStockMap(
    tenantId: string,
    items: Array<{
      name: string;
      openingStock: number;
      unit?: string | null;
      secondaryUnit?: string | null;
      conversionRate?: string | null;
      tertiaryUnit?: string | null;
      tertiaryConversionRate?: string | null;
    }>,
    upTo?: Date,
    companyId?: string,
  ): Promise<Map<string, number>> {
    const stockMap = new Map<string, number>();
    const converters = new Map<string, (qty: number, lineUnit?: string | null) => number>();
    for (const item of items) {
      stockMap.set(item.name, item.openingStock);
      converters.set(item.name, this.buildUnitConverter(item));
    }

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['purchase', 'sale', 'credit_note', 'debit_note'] },
        ...(upTo ? { date: { lte: upTo } } : {}),
        ...companyIdWhere(companyId),
      },
    });

    for (const t of txns) {
      const lineItems = parseItems(t.notes);
      for (const li of lineItems) {
        const current = stockMap.get(li.name) ?? 0;
        const convert = converters.get(li.name);
        const qtyInBaseUnits = convert ? convert(li.qty ?? 0, li.unit) : (li.qty ?? 0);
        if (t.type === 'purchase' || t.type === 'credit_note') {
          stockMap.set(li.name, current + qtyInBaseUnits);
        } else if (t.type === 'sale' || t.type === 'debit_note') {
          stockMap.set(li.name, current - qtyInBaseUnits);
        }
      }
    }

    return stockMap;
  }

  // ── Stock Summary ───────────────────────────────────────────────────────────

  async getStockSummary(tenantId: string, asOf?: string, companyId?: string) {
    const upTo = asOf ? (parseDate(asOf) ? endOfDay(parseDate(asOf)!) : undefined) : undefined;
    const items = await this.prisma.item.findMany({ where: { tenantId, ...companyIdWhere(companyId) } });
    const stockMap = await this.computeStockMap(tenantId, items, upTo, companyId);

    let totalStockQty = 0;
    let totalStockValue = 0;

    const result = items.map((item, i) => {
      const stockQty = stockMap.get(item.name) ?? item.openingStock;
      const pp = item.purchasePrice ?? 0;
      // Oversold stock (more sold than ever recorded as bought) goes negative — worth
      // showing as-is in stockQty so it surfaces as a data problem, but it can't drag the
      // *value* below zero; there's no such thing as negative inventory on hand.
      const stockValue = Math.max(0, stockQty) * pp;
      totalStockQty += stockQty;
      totalStockValue += stockValue;

      return {
        index: i + 1,
        name: item.name,
        salePrice: item.salePrice ?? 0,
        purchasePrice: pp,
        stockQty,
        unit: item.unit ?? '',
        secondaryUnit: item.secondaryUnit ?? null,
        conversionRate: item.conversionRate ? Number(item.conversionRate) : null,
        tertiaryUnit: item.tertiaryUnit ?? null,
        tertiaryConversionRate: item.tertiaryConversionRate ? Number(item.tertiaryConversionRate) : null,
        stockValue,
      };
    });

    return {
      items: result,
      total: { stockQty: totalStockQty, stockValue: totalStockValue },
    };
  }

  // ── Low Stock ───────────────────────────────────────────────────────────────

  async getLowStock(tenantId: string, companyId?: string) {
    const items = await this.prisma.item.findMany({ where: { tenantId, ...companyIdWhere(companyId) } });
    const stockMap = await this.computeStockMap(tenantId, items, undefined, companyId);

    let totalStockQty = 0;
    let totalStockValue = 0;

    const lowItems = items
      .map((item) => {
        const stockQty = stockMap.get(item.name) ?? item.openingStock;
        const pp = item.purchasePrice ?? 0;
        const stockValue = Math.max(0, stockQty) * pp;
        return { item, stockQty, stockValue };
      })
      .filter(({ item, stockQty }) => stockQty <= item.minStock)
      .map(({ item, stockQty, stockValue }, i) => {
        totalStockQty += stockQty;
        totalStockValue += stockValue;
        return {
          index: i + 1,
          name: item.name,
          minStockQty: item.minStock,
          stockQty,
          stockValue,
        };
      });

    return {
      items: lowItems,
      total: { stockQty: totalStockQty, stockValue: totalStockValue },
    };
  }

  // ── Stock Detail ────────────────────────────────────────────────────────────

  async getStockDetail(tenantId: string, from?: string, to?: string, companyId?: string) {
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    const dateFilter = buildDateFilter(from, to);

    const items = await this.prisma.item.findMany({ where: { tenantId, ...companyIdWhere(companyId) } });

    // Beginning qty: stock before `from`
    const beginMap = fromDate
      ? await this.computeStockMap(tenantId, items, new Date(startOfDay(fromDate).getTime() - 1), companyId)
      : new Map(items.map((i) => [i.name, i.openingStock]));

    // Movements in range
    const txnsInRange = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['purchase', 'sale', 'credit_note', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
    });

    // per-item aggregates
    const itemStats = new Map<
      string,
      { qtyIn: number; purchaseAmount: number; qtyOut: number; saleAmount: number }
    >();
    for (const item of items) {
      itemStats.set(item.name, { qtyIn: 0, purchaseAmount: 0, qtyOut: 0, saleAmount: 0 });
    }

    for (const t of txnsInRange) {
      const lineItems = parseItems(t.notes);
      for (const li of lineItems) {
        const stats = itemStats.get(li.name) ?? { qtyIn: 0, purchaseAmount: 0, qtyOut: 0, saleAmount: 0 };
        if (t.type === 'purchase' || t.type === 'credit_note') {
          stats.qtyIn += li.qty ?? 0;
          stats.purchaseAmount += (li.qty ?? 0) * (li.rate ?? 0);
        } else if (t.type === 'sale' || t.type === 'debit_note') {
          stats.qtyOut += li.qty ?? 0;
          stats.saleAmount += (li.qty ?? 0) * (li.rate ?? 0);
        }
        itemStats.set(li.name, stats);
      }
    }

    const totals = { beginningQty: 0, qtyIn: 0, purchaseAmount: 0, qtyOut: 0, saleAmount: 0, closingQty: 0 };

    const result = items.map((item) => {
      const beginningQty = beginMap.get(item.name) ?? item.openingStock;
      const stats = itemStats.get(item.name) ?? { qtyIn: 0, purchaseAmount: 0, qtyOut: 0, saleAmount: 0 };
      const closingQty = beginningQty + stats.qtyIn - stats.qtyOut;

      totals.beginningQty += beginningQty;
      totals.qtyIn += stats.qtyIn;
      totals.purchaseAmount += stats.purchaseAmount;
      totals.qtyOut += stats.qtyOut;
      totals.saleAmount += stats.saleAmount;
      totals.closingQty += closingQty;

      return {
        name: item.name,
        beginningQty,
        qtyIn: stats.qtyIn,
        purchaseAmount: stats.purchaseAmount,
        qtyOut: stats.qtyOut,
        saleAmount: stats.saleAmount,
        closingQty,
      };
    });

    return { items: result, total: totals };
  }

  // ── Item Detail ─────────────────────────────────────────────────────────────

  async getItemDetail(tenantId: string, from?: string, to?: string, itemName?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase', 'credit_note', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
      orderBy: { date: 'asc' },
    });

    // Group by date (day) for the given item(s)
    const dayMap = new Map<
      string,
      { saleQty: number; purchaseQty: number; adjustmentQty: number }
    >();

    for (const t of txns) {
      const lineItems = parseItems(t.notes);
      const relevant = itemName ? lineItems.filter((li) => li.name === itemName) : lineItems;
      if (relevant.length === 0) continue;

      const dayKey = t.date.toISOString().slice(0, 10);
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { saleQty: 0, purchaseQty: 0, adjustmentQty: 0 });
      }
      const entry = dayMap.get(dayKey)!;

      for (const li of relevant) {
        if (t.type === 'sale' || t.type === 'debit_note') {
          entry.saleQty += li.qty ?? 0;
        } else if (t.type === 'purchase' || t.type === 'credit_note') {
          entry.purchaseQty += li.qty ?? 0;
        }
      }
    }

    // Compute running closing qty
    let runningQty = 0;
    const items = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entry]) => {
        runningQty += entry.purchaseQty - entry.saleQty;
        return {
          date,
          saleQty: entry.saleQty,
          purchaseQty: entry.purchaseQty,
          adjustmentQty: 0,
          closingQty: runningQty,
        };
      });

    return { items };
  }

  // ── Item Wise P&L ───────────────────────────────────────────────────────────

  async getItemWisePnl(tenantId: string, from?: string, to?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);
    const toDate = parseDate(to);

    const allItems = await this.prisma.item.findMany({ where: { tenantId, ...companyIdWhere(companyId) } });
    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase', 'credit_note', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
    });

    const itemStats = new Map<
      string,
      { sale: number; creditNote: number; purchase: number; debitNote: number; saleQty: number; purchaseQty: number }
    >();

    for (const t of txns) {
      const lineItems = parseItems(t.notes);
      for (const li of lineItems) {
        const existing = itemStats.get(li.name) ?? {
          sale: 0, creditNote: 0, purchase: 0, debitNote: 0, saleQty: 0, purchaseQty: 0,
        };
        const amount = (li.qty ?? 0) * (li.rate ?? 0);
        if (t.type === 'sale') { existing.sale += amount; existing.saleQty += li.qty ?? 0; }
        else if (t.type === 'credit_note') { existing.creditNote += amount; existing.saleQty -= li.qty ?? 0; }
        else if (t.type === 'purchase') { existing.purchase += amount; existing.purchaseQty += li.qty ?? 0; }
        else if (t.type === 'debit_note') { existing.debitNote += amount; existing.purchaseQty -= li.qty ?? 0; }
        itemStats.set(li.name, existing);
      }
    }

    const stockMap = await this.computeStockMap(tenantId, allItems, toDate ? endOfDay(toDate) : undefined, companyId);

    let totalAmount = 0;
    const items = allItems.map((item) => {
      const stats = itemStats.get(item.name) ?? {
        sale: 0, creditNote: 0, purchase: 0, debitNote: 0, saleQty: 0, purchaseQty: 0,
      };
      const pp = item.purchasePrice ?? 0;
      const openingStock = item.openingStock * pp;
      const closingQty = stockMap.get(item.name) ?? item.openingStock;
      const closingStock = closingQty * pp;
      const netProfit = stats.sale - stats.creditNote - stats.purchase + stats.debitNote - openingStock + closingStock;
      totalAmount += netProfit;

      return {
        name: item.name,
        sale: stats.sale,
        creditNote: stats.creditNote,
        purchase: stats.purchase,
        debitNote: stats.debitNote,
        openingStock,
        closingStock,
        taxReceivable: 0,
        taxPayable: 0,
        mfgCost: 0,
        consumptionCost: 0,
        netProfit,
      };
    });

    return { items, totalAmount };
  }

  // ── Item Category P&L ───────────────────────────────────────────────────────

  async getItemCategoryPnl(tenantId: string, from?: string, to?: string, companyId?: string) {
    const { items } = await this.getItemWisePnl(tenantId, from, to, companyId);
    const totals = items.reduce(
      (acc, item) => ({
        sale: acc.sale + item.sale,
        creditNote: acc.creditNote + item.creditNote,
        purchase: acc.purchase + item.purchase,
        debitNote: acc.debitNote + item.debitNote,
        openingStock: acc.openingStock + item.openingStock,
        closingStock: acc.closingStock + item.closingStock,
        netProfit: acc.netProfit + item.netProfit,
      }),
      { sale: 0, creditNote: 0, purchase: 0, debitNote: 0, openingStock: 0, closingStock: 0, netProfit: 0 },
    );

    return {
      categories: [{ name: 'General', ...totals }],
    };
  }

  // ── Sale/Purchase By Item Category ─────────────────────────────────────────

  async getSalePurchaseByItemCategory(tenantId: string, from?: string, to?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
    });

    let saleQty = 0;
    let saleAmount = 0;
    let purchaseQty = 0;
    let purchaseAmount = 0;

    for (const t of txns) {
      const lineItems = parseItems(t.notes);
      const totalQty = lineItems.reduce((s, li) => s + (li.qty ?? 0), 0);
      if (t.type === 'sale') {
        saleQty += totalQty;
        saleAmount += t.total;
      } else {
        purchaseQty += totalQty;
        purchaseAmount += t.total;
      }
    }

    return {
      categories: [{ category: 'General', saleQty, saleAmount, purchaseQty, purchaseAmount }],
    };
  }

  // ── Stock Summary By Category ───────────────────────────────────────────────

  async getStockSummaryByCategory(tenantId: string, companyId?: string) {
    const { total } = await this.getStockSummary(tenantId, undefined, companyId);
    return {
      categories: [{ category: 'General', stockQty: total.stockQty, stockValue: total.stockValue }],
    };
  }

  // ── Item Wise Discount ──────────────────────────────────────────────────────

  async getItemWiseDiscount(_tenantId: string, _from?: string, _to?: string) {
    return { items: [], totalSaleAmount: 0, totalDiscountAmount: 0 };
  }

  // ── Bank Statement ──────────────────────────────────────────────────────────

  async getBankStatement(_tenantId: string, _from?: string, _to?: string) {
    return { bankName: '', transactions: [], balance: 0 };
  }

  // ── Discount Report ─────────────────────────────────────────────────────────

  async getDiscountReport(tenantId: string, _from?: string, _to?: string) {
    const parties = await this.prisma.party.findMany({ where: { tenantId, isSystem: false } });
    return {
      parties: parties.map((p) => ({ name: p.name, saleDiscount: 0, purchaseDiscount: 0 })),
      totalSaleDiscount: 0,
      totalPurchaseDiscount: 0,
    };
  }

  // ── Tax Report ──────────────────────────────────────────────────────────────

  async getTaxReport(tenantId: string, _from?: string, _to?: string) {
    const parties = await this.prisma.party.findMany({ where: { tenantId, isSystem: false } });
    return {
      parties: parties.map((p) => ({ name: p.name, saleTax: 0, purchaseTax: 0 })),
      totalTaxIn: 0,
      totalTaxOut: 0,
    };
  }

  // ── Tax Rate Report ─────────────────────────────────────────────────────────

  async getTaxRateReport(_tenantId: string, _from?: string, _to?: string) {
    return { rates: [], totalTaxIn: 0, totalTaxOut: 0 };
  }

  // ── Expense Report ──────────────────────────────────────────────────────────

  async getExpense(tenantId: string, from?: string, to?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'expense',
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
      include: { party: true },
      orderBy: { date: 'desc' },
    });

    let totalAmount = 0;
    const transactions = txns.map((t) => {
      const noteObj = parseNoteObj(t.notes);
      const paymentType: string = noteObj.paymentType ?? 'Cash';
      totalAmount += t.total;

      return {
        date: t.date.toISOString(),
        expNo: t.number ?? '',
        party: t.party.name,
        category: noteObj.category ?? '',
        paymentType,
        amount: t.total,
        balanceDue: t.balance,
        status: txnStatus(t.total, t.balance),
      };
    });

    return { transactions, totalAmount };
  }

  // ── Expense Category ────────────────────────────────────────────────────────

  async getExpenseCategory(tenantId: string, from?: string, to?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'expense',
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
    });

    const catMap = new Map<string, number>();
    let totalExpense = 0;

    for (const t of txns) {
      const noteObj = parseNoteObj(t.notes);
      const category: string = noteObj.category ?? 'General';
      catMap.set(category, (catMap.get(category) ?? 0) + t.total);
      totalExpense += t.total;
    }

    const categories = Array.from(catMap.entries()).map(([category, amount]) => ({
      category,
      categoryType: 'Indirect Expense',
      amount,
    }));

    return { categories, totalExpense };
  }

  // ── Expense Item ────────────────────────────────────────────────────────────

  async getExpenseItem(tenantId: string, from?: string, to?: string, companyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'expense',
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
    });

    const itemMap = new Map<string, { unitPrice: number; amount: number }>();
    let totalQty = 0;
    let totalAmount = 0;

    for (const t of txns) {
      const noteObj = parseNoteObj(t.notes);
      const description: string = noteObj.description ?? 'Expense';
      const existing = itemMap.get(description) ?? { unitPrice: t.total, amount: 0 };
      existing.amount += t.total;
      totalAmount += t.total;
      totalQty += 1;
      itemMap.set(description, existing);
    }

    const items = Array.from(itemMap.entries()).map(([expenseItem, { unitPrice, amount }]) => ({
      expenseItem,
      unitPrice,
      quantity: 1,
      amount,
    }));

    return { items, totalQty, totalAmount };
  }

  // ── Sale/Purchase Orders ────────────────────────────────────────────────────

  async getSalePurchaseOrders(
    tenantId: string,
    from?: string,
    to?: string,
    orderType?: string,
    _status?: string,
    companyId?: string,
  ) {
    const dateFilter = buildDateFilter(from, to);
    const orderTypes = orderType
      ? [orderType]
      : ['sale_order', 'purchase_order', 'estimate', 'proforma_invoice', 'delivery_challan', 'purchase_return'];

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: orderTypes },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
      include: { party: true },
      orderBy: { date: 'desc' },
    });

    let totalAmount = 0;
    const orders = txns.map((t) => {
      totalAmount += t.total;
      return {
        date: t.date.toISOString(),
        orderNo: t.number ?? '',
        name: t.party.name,
        dueDate: null,
        status: 'Order Open',
        type: t.type,
        total: t.total,
        advance: 0,
        balance: t.balance,
      };
    });

    return { orders, totalAmount };
  }

  // ── Sale/Purchase Order Items ───────────────────────────────────────────────

  async getSalePurchaseOrderItems(
    tenantId: string,
    from?: string,
    to?: string,
    orderType?: string,
    _status?: string,
    companyId?: string,
  ) {
    const dateFilter = buildDateFilter(from, to);
    const orderTypes = orderType
      ? [orderType]
      : ['sale_order', 'purchase_order', 'estimate', 'proforma_invoice', 'delivery_challan', 'purchase_return'];

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: orderTypes },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...companyIdWhere(companyId),
      },
    });

    const itemMap = new Map<string, { qty: number; amount: number }>();

    for (const t of txns) {
      const lineItems = parseItems(t.notes);
      for (const li of lineItems) {
        const existing = itemMap.get(li.name) ?? { qty: 0, amount: 0 };
        existing.qty += li.qty ?? 0;
        existing.amount += (li.qty ?? 0) * (li.rate ?? 0);
        itemMap.set(li.name, existing);
      }
    }

    const items = Array.from(itemMap.entries()).map(([name, { qty, amount }]) => ({ name, qty, amount }));
    const total = items.reduce(
      (acc, item) => ({ qty: acc.qty + item.qty, amount: acc.amount + item.amount }),
      { qty: 0, amount: 0 },
    );

    return { items, total };
  }

  // ── Loan Statement ──────────────────────────────────────────────────────────

  async getLoanStatement(_tenantId: string, _from?: string, _to?: string) {
    return {
      account: '',
      transactions: [],
      summary: {
        openingBalance: 0,
        balanceDue: 0,
        totalPrincipalPaid: 0,
        totalInterestPaid: 0,
      },
    };
  }
}
