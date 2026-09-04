import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { companyIdWhere } from "../common/company-filter.util";

function parseNoteObj(notes: string | null): Record<string, any> {
  if (!notes) return {};
  try {
    const p = JSON.parse(notes);
    if (p && !Array.isArray(p) && typeof p === "object") return p;
    return {};
  } catch { return {}; }
}

const CASH_IN_TYPES  = new Set(["payment_in", "sale", "credit_note", "cash_in", "pos_sale"]);
const CASH_OUT_TYPES = new Set(["payment_out", "purchase", "expense", "debit_note", "cash_out"]);

function isCashTxn(type: string, notes: string | null): boolean {
  if (type === "cash_in" || type === "cash_out") return true;
  const obj = parseNoteObj(notes);
  const pt: string = obj.paymentType ?? "Cash";
  return pt === "Cash";
}

function txnDirection(type: string): "in" | "out" {
  return CASH_IN_TYPES.has(type) ? "in" : "out";
}

// Sale/Purchase invoices can be partially or fully unpaid — only the portion actually
// received/paid moves cash, not the full invoice total. But most of that paid-down portion
// already arrived as its own payment_in/payment_out transaction (tracked via
// PaymentAllocation) — counting it again here would double it. Only the leftover, paid
// with no linked allocation (cash collected at the counter, right at sale/purchase time),
// is a genuinely separate cash movement. Every other cash-affecting type (payment_in/out,
// cash_in/out, credit/debit note, expense, pos_sale) IS the money movement itself, so its
// `total` is used as-is.
function cashAmount(t: { type: string; total: number; balance: number; id: string }, allocatedByInvoice: Map<string, number>): number {
  if (t.type === "sale" || t.type === "purchase") {
    const paid = t.total - t.balance;
    const allocated = allocatedByInvoice.get(t.id) ?? 0;
    return Math.max(0, paid - allocated);
  }
  // A credit/debit note adjusts what a party owes — it's a receivable/payable document,
  // not a payment voucher. No cash actually changes hands for it (confirmed against real
  // Vyapar data: every credit-note row there carries a cash amount of exactly 0).
  if (t.type === "credit_note" || t.type === "debit_note") return 0;
  return t.total;
}

function txnLabel(type: string): string {
  const map: Record<string, string> = {
    sale: "Sale", purchase: "Purchase", payment_in: "Payment-In",
    payment_out: "Payment-Out", expense: "Expense", credit_note: "Credit Note",
    debit_note: "Debit Note", cash_in: "Cash Added", cash_out: "Cash Reduced",
    pos_sale: "PoS Sale", estimate: "Estimate", proforma: "Proforma",
    delivery: "Delivery Challan", sale_order: "Sale Order", purchase_order: "Purchase Order",
    purchase_return: "Purchase Return",
  };
  return map[type] ?? type;
}

@Injectable()
export class CashBankService {
  constructor(private readonly prisma: PrismaService) {}

  // Finds or creates a system party used for non-party transactions (e.g. cash adjustments)
  private async getSystemParty(tenantId: string): Promise<string> {
    const existing = await this.prisma.party.findFirst({
      where: { tenantId, isSystem: true },
    });
    if (existing) return existing.id;
    const created = await this.prisma.party.create({
      data: { tenantId, name: "System", isSystem: true },
    });
    return created.id;
  }

  // How many cash-relevant rows to actually return for display — the balance below
  // still scans full history (unavoidable: a Sale/Purchase's cash portion depends on
  // its current balance, so every row must be read), but a tenant with tens of
  // thousands of transactions doesn't need all of them shipped to render one list.
  private static readonly LIST_LIMIT = 500;

  async getCashInHand(tenantId: string, companyId?: string) {
    // No `include: party` here — for a large tenant that join (and the full row
    // width) made this a multi-second scan. Only the columns cashAmount/isCashTxn
    // actually need are selected; party names are fetched separately, only for the
    // rows that make it into the capped display list below.
    const txns = await this.prisma.transaction.findMany({
      where: { tenantId, ...companyIdWhere(companyId) },
      orderBy: { date: "desc" },
      select: { id: true, type: true, total: true, balance: true, notes: true, date: true, number: true, partyId: true },
    });

    const allocations = await this.prisma.paymentAllocation.groupBy({
      by: ["invoiceTxnId"],
      where: { tenantId },
      _sum: { amount: true },
    });
    const allocatedByInvoice = new Map(allocations.map(a => [a.invoiceTxnId, a._sum.amount ?? 0]));

    const cashTxns = txns.filter(t =>
      (CASH_IN_TYPES.has(t.type) || CASH_OUT_TYPES.has(t.type)) &&
      isCashTxn(t.type, t.notes) &&
      cashAmount(t, allocatedByInvoice) !== 0 // drop fully-unpaid/fully-allocated credit sales/purchases — no separate cash moved
    );

    let balance = 0;
    for (const t of cashTxns) {
      if (txnDirection(t.type) === "in")  balance += cashAmount(t, allocatedByInvoice);
      else                                balance -= cashAmount(t, allocatedByInvoice);
    }

    const visible = cashTxns.slice(0, CashBankService.LIST_LIMIT);
    const partyIds = [...new Set(visible.map(t => t.partyId).filter((id): id is string => !!id))];
    const parties = partyIds.length
      ? await this.prisma.party.findMany({ where: { id: { in: partyIds } }, select: { id: true, name: true, isSystem: true } })
      : [];
    const partyById = new Map(parties.map(p => [p.id, p]));

    const transactions = visible.map(t => {
      const noteObj = parseNoteObj(t.notes);
      const dir = txnDirection(t.type);
      const party = t.partyId ? partyById.get(t.partyId) : undefined;
      const partyName = party?.isSystem ? null : party?.name;
      return {
        id:        t.id,
        type:      txnLabel(t.type),
        rawType:   t.type,
        name:      partyName ?? noteObj.description ?? noteObj.category ?? "—",
        date:      t.date.toISOString(),
        amount:    cashAmount(t, allocatedByInvoice),
        direction: dir,
        invoiceNo: t.number ?? null,
      };
    });

    return { balance, transactions, totalCount: cashTxns.length };
  }

  async adjustCash(tenantId: string, body: {
    mode: "add" | "reduce";
    amount: number;
    date: string;
    description?: string;
    companyId?: string;
  }) {
    const partyId = await this.getSystemParty(tenantId);
    const type = body.mode === "add" ? "cash_in" : "cash_out";
    return this.prisma.transaction.create({
      data: {
        tenantId,
        partyId,
        type,
        total:   body.amount,
        balance: 0,
        date:    new Date(body.date),
        notes:   JSON.stringify({ description: body.description ?? "", paymentType: "Cash" }),
        companyId: body.companyId ?? null,
      },
    });
  }

  // ── Bank Accounts ──────────────────────────────────────────────────────────

  async getBankAccounts(tenantId: string) {
    return this.prisma.bankAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createBankAccount(tenantId: string, body: {
    name: string;
    openingBalance?: number;
    openingBalanceDate?: string;
    printOnInvoices?: boolean;
  }) {
    return this.prisma.bankAccount.create({
      data: {
        tenantId,
        name:               body.name,
        openingBalance:     body.openingBalance ?? 0,
        openingBalanceDate: body.openingBalanceDate ? new Date(body.openingBalanceDate) : new Date(),
        printOnInvoices:    body.printOnInvoices ?? false,
      },
    });
  }

  async updateBankAccount(tenantId: string, id: string, body: {
    name?: string;
    openingBalance?: number;
    openingBalanceDate?: string;
    printOnInvoices?: boolean;
  }) {
    return this.prisma.bankAccount.updateMany({
      where: { id, tenantId },
      data: {
        ...(body.name !== undefined             && { name: body.name }),
        ...(body.openingBalance !== undefined   && { openingBalance: body.openingBalance }),
        ...(body.openingBalanceDate !== undefined && { openingBalanceDate: new Date(body.openingBalanceDate) }),
        ...(body.printOnInvoices !== undefined  && { printOnInvoices: body.printOnInvoices }),
      },
    });
  }

  async deleteBankAccount(tenantId: string, id: string) {
    return this.prisma.bankAccount.deleteMany({ where: { id, tenantId } });
  }
}
