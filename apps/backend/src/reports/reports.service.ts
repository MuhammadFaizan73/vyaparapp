import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseItems(
  notes: string | null,
): Array<{ name: string; qty: number; rate: number; mrp?: number; unit?: string }> {
  if (!notes) return [];
  try {
    const p = JSON.parse(notes);
    return Array.isArray(p) ? p : [];
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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

  async getSaleReport(tenantId: string, from?: string, to?: string, status?: string, partyId?: string, companyTag?: string) {
    const dateFilter = buildDateFilter(from, to);

    // Build set of item names tagged to the requested company (for client-side filtering)
    let companyItemNames: Set<string> | null = null;
    if (companyTag) {
      const taggedItems = await this.prisma.item.findMany({
        where: { tenantId, companyTag },
        select: { name: true },
      });
      companyItemNames = new Set(taggedItems.map((i) => i.name.toLowerCase()));
    }

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'credit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(partyId ? { partyId } : {}),
      },
      include: { party: true },
      orderBy: { date: 'desc' },
    });

    let totalAmount = 0;
    let received = 0;
    let balanceSum = 0;
    let creditNoteTotal = 0;

    const transactions = txns
      .filter((t) => {
        if (!companyItemNames) return true;
        const noteObj = parseNoteObj(t.notes);
        const items: Array<{ name?: string }> = Array.isArray(noteObj.items) ? noteObj.items : (Array.isArray(noteObj) ? noteObj : []);
        return items.some((i) => i.name && companyItemNames!.has(i.name.toLowerCase()));
      })
      .map((t) => {
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

  async getPurchaseReport(tenantId: string, from?: string, to?: string, status?: string, partyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['purchase', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(partyId ? { partyId } : {}),
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

  async getDayBook(tenantId: string, date?: string) {
    const target = date ? (parseDate(date) ?? new Date()) : new Date();
    const dayStart = startOfDay(target);
    const dayEnd = endOfDay(target);

    const txns = await this.prisma.transaction.findMany({
      where: { tenantId, date: { gte: dayStart, lte: dayEnd } },
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
  ) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        ...(txnType ? { type: txnType } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(partyId ? { partyId } : {}),
      },
      include: { party: true },
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
      };
    });

    const statusFiltered = status ? transactions.filter((t) => t.status === status) : transactions;

    return { transactions: statusFiltered };
  }

  // ── Profit & Loss ───────────────────────────────────────────────────────────

  async getProfitAndLoss(tenantId: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);
    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { date: dateFilter } : {}),
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
    const items = await this.prisma.item.findMany({ where: { tenantId } });

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
      viewType: 'vyapar',
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

  async getCashFlow(tenantId: string, from?: string, to?: string) {
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

  async getPartyStatement(tenantId: string, from?: string, to?: string, partyId?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        ...(partyId ? { partyId } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
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

      // Running receivable / payable
      if (t.type === 'sale' || t.type === 'credit_note') {
        totalSale += t.total;
        receivableBalance += txnBalance;
      } else if (t.type === 'purchase' || t.type === 'debit_note') {
        totalPurchase += t.total;
        payableBalance += txnBalance;
      } else if (t.type === 'payment_in') {
        totalMoneyIn += t.total;
        receivableBalance -= t.total;
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

  async getAllParties(tenantId: string) {
    const parties = await this.prisma.party.findMany({
      where: { tenantId, isSystem: false },
      include: { transactions: true },
    });

    let totalReceivable = 0;
    let totalPayable = 0;

    const result = parties.map((p, i) => {
      let receivableBalance = 0;
      let payableBalance = 0;

      for (const t of p.transactions) {
        if (t.type === 'sale' || t.type === 'credit_note') {
          receivableBalance += t.balance;
        } else if (t.type === 'purchase' || t.type === 'debit_note') {
          payableBalance += t.balance;
        } else if (t.type === 'payment_in') {
          receivableBalance -= t.total;
        } else if (t.type === 'payment_out') {
          payableBalance -= t.total;
        }
      }

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

  async getPartyReportByItem(tenantId: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase', 'credit_note', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: { party: true },
    });

    const partyMap = new Map<
      string,
      { partyName: string; saleQty: number; saleAmount: number; purchaseQty: number; purchaseAmount: number }
    >();

    for (const t of txns) {
      const name = t.party.name;
      if (!partyMap.has(name)) {
        partyMap.set(name, { partyName: name, saleQty: 0, saleAmount: 0, purchaseQty: 0, purchaseAmount: 0 });
      }
      const entry = partyMap.get(name)!;
      const items = parseItems(t.notes);
      const totalQty = items.reduce((s, li) => s + (li.qty ?? 0), 0);

      if (t.type === 'sale') {
        entry.saleQty += totalQty;
        entry.saleAmount += t.total;
      } else if (t.type === 'purchase') {
        entry.purchaseQty += totalQty;
        entry.purchaseAmount += t.total;
      } else if (t.type === 'credit_note') {
        entry.saleQty -= totalQty;
        entry.saleAmount -= t.total;
      } else if (t.type === 'debit_note') {
        entry.purchaseQty -= totalQty;
        entry.purchaseAmount -= t.total;
      }
    }

    const parties = Array.from(partyMap.values());
    const total = parties.reduce(
      (acc, p) => ({
        saleQty: acc.saleQty + p.saleQty,
        saleAmount: acc.saleAmount + p.saleAmount,
        purchaseQty: acc.purchaseQty + p.purchaseQty,
        purchaseAmount: acc.purchaseAmount + p.purchaseAmount,
      }),
      { saleQty: 0, saleAmount: 0, purchaseQty: 0, purchaseAmount: 0 },
    );

    return { parties, total };
  }

  // ── Sale/Purchase By Party ──────────────────────────────────────────────────

  async getSalePurchaseByParty(tenantId: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase'] },
        ...(dateFilter ? { date: dateFilter } : {}),
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

  async getSalePurchaseByPartyGroup(tenantId: string, from?: string, to?: string) {
    const { totalSaleAmount, totalPurchaseAmount } = await this.getSalePurchaseByParty(tenantId, from, to);
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

  private async computeStockMap(
    tenantId: string,
    items: Array<{ name: string; openingStock: number }>,
    upTo?: Date,
  ): Promise<Map<string, number>> {
    const stockMap = new Map<string, number>();
    for (const item of items) {
      stockMap.set(item.name, item.openingStock);
    }

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['purchase', 'sale', 'credit_note', 'debit_note'] },
        ...(upTo ? { date: { lte: upTo } } : {}),
      },
    });

    for (const t of txns) {
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

    return stockMap;
  }

  // ── Stock Summary ───────────────────────────────────────────────────────────

  async getStockSummary(tenantId: string, asOf?: string) {
    const upTo = asOf ? (parseDate(asOf) ? endOfDay(parseDate(asOf)!) : undefined) : undefined;
    const items = await this.prisma.item.findMany({ where: { tenantId } });
    const stockMap = await this.computeStockMap(tenantId, items, upTo);

    let totalStockQty = 0;
    let totalStockValue = 0;

    const result = items.map((item, i) => {
      const stockQty = stockMap.get(item.name) ?? item.openingStock;
      const pp = item.purchasePrice ?? 0;
      const stockValue = stockQty * pp;
      totalStockQty += stockQty;
      totalStockValue += stockValue;

      return {
        index: i + 1,
        name: item.name,
        salePrice: item.salePrice ?? 0,
        purchasePrice: pp,
        stockQty,
        stockValue,
      };
    });

    return {
      items: result,
      total: { stockQty: totalStockQty, stockValue: totalStockValue },
    };
  }

  // ── Low Stock ───────────────────────────────────────────────────────────────

  async getLowStock(tenantId: string) {
    const items = await this.prisma.item.findMany({ where: { tenantId } });
    const stockMap = await this.computeStockMap(tenantId, items);

    let totalStockQty = 0;
    let totalStockValue = 0;

    const lowItems = items
      .map((item) => {
        const stockQty = stockMap.get(item.name) ?? item.openingStock;
        const pp = item.purchasePrice ?? 0;
        const stockValue = stockQty * pp;
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

  async getStockDetail(tenantId: string, from?: string, to?: string) {
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    const dateFilter = buildDateFilter(from, to);

    const items = await this.prisma.item.findMany({ where: { tenantId } });

    // Beginning qty: stock before `from`
    const beginMap = fromDate
      ? await this.computeStockMap(tenantId, items, new Date(startOfDay(fromDate).getTime() - 1))
      : new Map(items.map((i) => [i.name, i.openingStock]));

    // Movements in range
    const txnsInRange = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['purchase', 'sale', 'credit_note', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
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

  async getItemDetail(tenantId: string, from?: string, to?: string, itemName?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase', 'credit_note', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
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

  async getItemWisePnl(tenantId: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);
    const toDate = parseDate(to);

    const allItems = await this.prisma.item.findMany({ where: { tenantId } });
    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase', 'credit_note', 'debit_note'] },
        ...(dateFilter ? { date: dateFilter } : {}),
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

    const stockMap = await this.computeStockMap(tenantId, allItems, toDate ? endOfDay(toDate) : undefined);

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

  async getItemCategoryPnl(tenantId: string, from?: string, to?: string) {
    const { items } = await this.getItemWisePnl(tenantId, from, to);
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

  async getSalePurchaseByItemCategory(tenantId: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: { in: ['sale', 'purchase'] },
        ...(dateFilter ? { date: dateFilter } : {}),
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

  async getStockSummaryByCategory(tenantId: string) {
    const { total } = await this.getStockSummary(tenantId);
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

  async getExpense(tenantId: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'expense',
        ...(dateFilter ? { date: dateFilter } : {}),
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

  async getExpenseCategory(tenantId: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'expense',
        ...(dateFilter ? { date: dateFilter } : {}),
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

  async getExpenseItem(tenantId: string, from?: string, to?: string) {
    const dateFilter = buildDateFilter(from, to);

    const txns = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        type: 'expense',
        ...(dateFilter ? { date: dateFilter } : {}),
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
