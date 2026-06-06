import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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

  async getCashInHand(tenantId: string) {
    const txns = await this.prisma.transaction.findMany({
      where: { tenantId },
      orderBy: { date: "desc" },
      include: { party: { select: { name: true, isSystem: true } } },
    });

    const cashTxns = txns.filter(t =>
      (CASH_IN_TYPES.has(t.type) || CASH_OUT_TYPES.has(t.type)) &&
      isCashTxn(t.type, t.notes)
    );

    let balance = 0;
    for (const t of cashTxns) {
      if (txnDirection(t.type) === "in")  balance += t.total;
      else                                balance -= t.total;
    }

    const transactions = cashTxns.map(t => {
      const noteObj = parseNoteObj(t.notes);
      const dir = txnDirection(t.type);
      const partyName = t.party?.isSystem ? null : t.party?.name;
      return {
        id:        t.id,
        type:      txnLabel(t.type),
        rawType:   t.type,
        name:      partyName ?? noteObj.description ?? noteObj.category ?? "—",
        date:      t.date.toISOString(),
        amount:    t.total,
        direction: dir,
        invoiceNo: t.number ?? null,
      };
    });

    return { balance, transactions };
  }

  async adjustCash(tenantId: string, body: {
    mode: "add" | "reduce";
    amount: number;
    date: string;
    description?: string;
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
      },
    });
  }
}
