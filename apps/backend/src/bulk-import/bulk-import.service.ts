import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { BulkSaleImportRequestDto, BulkCashFlowImportRequestDto, BulkExpenseImportRequestDto } from "./bulk-import.dto";

const DEFAULT_EXPENSE_PARTY_NAME = "Business Expenses";

export type BulkImportJobStatus = {
  jobId: string;
  status: "processing" | "done" | "error";
  total: number;
  processed: number;
  itemsCreated: number;
  partiesCreated: number;
  invoicesImported: number;
  invoicesSkipped: number;
  entriesImported: number;
  entriesSkipped: number;
  error?: string;
};

// Maps the sheet's free-text "Transaction Type" column onto the schema's Transaction.type enum.
const TXN_TYPE_MAP: Record<string, string> = {
  "sale": "sale",
  "purchase": "purchase",
  "payment-in": "payment_in",
  "payment in": "payment_in",
  "payment-out": "payment_out",
  "payment out": "payment_out",
  "sale return": "credit_note",
  "purchase return": "debit_note",
};

const CHUNK_SIZE = 500;

@Injectable()
export class BulkImportService {
  private readonly jobs = new Map<string, BulkImportJobStatus>();

  constructor(private readonly prisma: PrismaService) {}

  start(tenantId: string, dto: BulkSaleImportRequestDto): { jobId: string } {
    const jobId = randomUUID();
    this.jobs.set(jobId, {
      jobId,
      status: "processing",
      total: dto.invoices?.length ?? 0,
      processed: 0,
      itemsCreated: 0,
      partiesCreated: 0,
      invoicesImported: 0,
      invoicesSkipped: 0,
      entriesImported: 0,
      entriesSkipped: 0,
    });

    setImmediate(() => {
      this.process(jobId, tenantId, dto).catch((err) => {
        const job = this.jobs.get(jobId);
        if (job) {
          job.status = "error";
          job.error = err instanceof Error ? err.message : String(err);
        }
      });
    });

    return { jobId };
  }

  startCashFlow(tenantId: string, dto: BulkCashFlowImportRequestDto): { jobId: string } {
    const jobId = randomUUID();
    this.jobs.set(jobId, {
      jobId,
      status: "processing",
      total: dto.entries?.length ?? 0,
      processed: 0,
      itemsCreated: 0,
      partiesCreated: 0,
      invoicesImported: 0,
      invoicesSkipped: 0,
      entriesImported: 0,
      entriesSkipped: 0,
    });

    setImmediate(() => {
      this.processCashFlow(jobId, tenantId, dto).catch((err) => {
        const job = this.jobs.get(jobId);
        if (job) {
          job.status = "error";
          job.error = err instanceof Error ? err.message : String(err);
        }
      });
    });

    return { jobId };
  }

  startExpenses(tenantId: string, dto: BulkExpenseImportRequestDto): { jobId: string } {
    const jobId = randomUUID();
    this.jobs.set(jobId, {
      jobId,
      status: "processing",
      total: dto.entries?.length ?? 0,
      processed: 0,
      itemsCreated: 0,
      partiesCreated: 0,
      invoicesImported: 0,
      invoicesSkipped: 0,
      entriesImported: 0,
      entriesSkipped: 0,
    });

    setImmediate(() => {
      this.processExpenses(jobId, tenantId, dto).catch((err) => {
        const job = this.jobs.get(jobId);
        if (job) {
          job.status = "error";
          job.error = err instanceof Error ? err.message : String(err);
        }
      });
    });

    return { jobId };
  }

  getStatus(jobId: string): BulkImportJobStatus | null {
    return this.jobs.get(jobId) ?? null;
  }

  private async process(jobId: string, tenantId: string, dto: BulkSaleImportRequestDto): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // 1. Items — create only ones not already present for this tenant (case-insensitive name match).
    const existingItems = await this.prisma.item.findMany({ where: { tenantId }, select: { name: true } });
    const existingItemNames = new Set(existingItems.map((i) => i.name.trim().toLowerCase()));
    const seenNewItemNames = new Set<string>();
    const newItems: Array<{ tenantId: string; name: string; unit: string | null; sku: string | null; salePrice: number | null; companyTag: string | null }> = [];
    for (const it of dto.items ?? []) {
      const key = it.name?.trim().toLowerCase();
      if (!key || existingItemNames.has(key) || seenNewItemNames.has(key)) continue;
      seenNewItemNames.add(key);
      newItems.push({
        tenantId,
        name: it.name.trim(),
        unit: it.unit || null,
        sku: it.sku || null,
        salePrice: it.salePrice ?? null,
        companyTag: dto.companyTag || null,
      });
    }
    if (newItems.length) {
      await this.prisma.item.createMany({ data: newItems });
      job.itemsCreated = newItems.length;
    }

    // 2. Parties — same dedupe strategy; resolve a name -> id map for linking transactions.
    const existingParties = await this.prisma.party.findMany({ where: { tenantId }, select: { id: true, name: true } });
    const partyIdByName = new Map<string, string>();
    for (const p of existingParties) partyIdByName.set(p.name.trim().toLowerCase(), p.id);

    const seenNewPartyNames = new Set<string>();
    const newPartyNames: string[] = [];
    const partyPhoneByName = new Map<string, string>();
    for (const p of dto.parties ?? []) {
      const key = p.name?.trim().toLowerCase();
      if (!key) continue;
      if (p.phone?.trim() && !partyPhoneByName.has(key)) partyPhoneByName.set(key, p.phone.trim());
      if (partyIdByName.has(key) || seenNewPartyNames.has(key)) continue;
      seenNewPartyNames.add(key);
      newPartyNames.push(p.name.trim());
    }
    if (newPartyNames.length) {
      await this.prisma.party.createMany({
        data: newPartyNames.map((name) => ({ tenantId, name, phone: partyPhoneByName.get(name.toLowerCase()) ?? null })),
      });
      job.partiesCreated = newPartyNames.length;
      const refreshed = await this.prisma.party.findMany({
        where: { tenantId, name: { in: newPartyNames } },
        select: { id: true, name: true },
      });
      for (const p of refreshed) partyIdByName.set(p.name.trim().toLowerCase(), p.id);
    }

    // 3. Existing transaction numbers (per type) — makes re-running the same file a no-op.
    const existingTxns = await this.prisma.transaction.findMany({ where: { tenantId }, select: { number: true, type: true } });
    const seenTxnKeys = new Set(existingTxns.filter((t) => t.number).map((t) => `${t.type}:${t.number}`));

    // 4. Build + batch-insert transactions, chunked so progress is visible while polling.
    const invoices = dto.invoices ?? [];
    let buffer: Array<{ tenantId: string; partyId: string; type: string; number: string; date: Date; total: number; balance: number; notes: string }> = [];

    const flush = async () => {
      if (!buffer.length) return;
      await this.prisma.transaction.createMany({ data: buffer });
      job.invoicesImported += buffer.length;
      buffer = [];
    };

    for (const inv of invoices) {
      job.processed++;
      const type = TXN_TYPE_MAP[inv.transactionType?.trim().toLowerCase()];
      const partyId = inv.partyName ? partyIdByName.get(inv.partyName.trim().toLowerCase()) : undefined;
      const date = inv.date ? new Date(inv.date) : null;
      const key = `${type}:${inv.number}`;

      if (!type || !partyId || !inv.number || !date || Number.isNaN(date.getTime()) || seenTxnKeys.has(key)) {
        job.invoicesSkipped++;
        continue;
      }
      seenTxnKeys.add(key);

      buffer.push({
        tenantId,
        partyId,
        type,
        number: inv.number,
        date,
        total: inv.total,
        balance: inv.balance ?? inv.total,
        // Every other transaction-creation path (SaleScreen, DeliveryChallanModal) stores
        // line items as a bare JSON array in `notes`, not wrapped in an object — match that
        // convention exactly or the invoice-edit/view screen won't recognize the items.
        notes: JSON.stringify((inv.lineItems ?? []).map((li) => ({ name: li.name, qty: li.qty, unit: li.unit, rate: li.rate }))),
      });

      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();

    job.status = "done";
  }

  private async processCashFlow(jobId: string, tenantId: string, dto: BulkCashFlowImportRequestDto): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // 1. Parties — same dedupe strategy as sale-history import.
    const existingParties = await this.prisma.party.findMany({ where: { tenantId }, select: { id: true, name: true } });
    const partyIdByName = new Map<string, string>();
    for (const p of existingParties) partyIdByName.set(p.name.trim().toLowerCase(), p.id);

    const seenNewPartyNames = new Set<string>();
    const newPartyNames: string[] = [];
    for (const p of dto.parties ?? []) {
      const key = p.name?.trim().toLowerCase();
      if (!key || partyIdByName.has(key) || seenNewPartyNames.has(key)) continue;
      seenNewPartyNames.add(key);
      newPartyNames.push(p.name.trim());
    }
    if (newPartyNames.length) {
      await this.prisma.party.createMany({ data: newPartyNames.map((name) => ({ tenantId, name })) });
      job.partiesCreated = newPartyNames.length;
      const refreshed = await this.prisma.party.findMany({
        where: { tenantId, name: { in: newPartyNames } },
        select: { id: true, name: true },
      });
      for (const p of refreshed) partyIdByName.set(p.name.trim().toLowerCase(), p.id);
    }

    // 2. Existing transaction numbers (per type) — makes re-running the same file a no-op.
    const existingTxns = await this.prisma.transaction.findMany({ where: { tenantId }, select: { number: true, type: true } });
    const seenTxnKeys = new Set(existingTxns.filter((t) => t.number).map((t) => `${t.type}:${t.number}`));

    // 3. Build + batch-insert payment_in / payment_out transactions.
    const entries = dto.entries ?? [];
    let buffer: Array<{ tenantId: string; partyId: string; type: string; number: string; date: Date; total: number; balance: number; notes: string }> = [];

    const flush = async () => {
      if (!buffer.length) return;
      await this.prisma.transaction.createMany({ data: buffer });
      job.entriesImported += buffer.length;
      buffer = [];
    };

    for (const e of entries) {
      job.processed++;
      const partyId = e.partyName ? partyIdByName.get(e.partyName.trim().toLowerCase()) : undefined;
      const date = e.date ? new Date(e.date) : null;
      const key = `${e.type}:${e.number}`;

      if (!partyId || !e.type || !e.number || !date || Number.isNaN(date.getTime()) || !(e.amount > 0) || seenTxnKeys.has(key)) {
        job.entriesSkipped++;
        continue;
      }
      seenTxnKeys.add(key);

      buffer.push({
        tenantId,
        partyId,
        type: e.type,
        number: e.number,
        date,
        total: e.amount,
        // PaymentInScreen/PurchaseScreen store the full amount as `balance` when nothing has
        // been linked to a specific invoice yet — matches that "unapplied" convention exactly,
        // since this import has no invoice-linking data to consume any of it.
        balance: e.amount,
        notes: JSON.stringify({ paymentType: "Cash", receiptNo: e.number, description: e.description }),
      });

      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();

    job.status = "done";
  }

  private async processExpenses(jobId: string, tenantId: string, dto: BulkExpenseImportRequestDto): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // 1. Expenses have no real vendor in the source data — find or create one placeholder
    // party to hold them all, same fallback PurchaseScreen's own "Add Expense" form uses
    // when no "Paid To" party is picked (an arbitrary existing party), except deliberate
    // and dedicated so it doesn't land on an unrelated real customer's ledger.
    // Case-insensitive lookup done in application code, not via Prisma's `mode: "insensitive"`
    // filter — that's Postgres-only and breaks the SQLite Prisma Client used in local dev.
    const partyName = (dto.partyName || DEFAULT_EXPENSE_PARTY_NAME).trim();
    const existingParties = await this.prisma.party.findMany({ where: { tenantId }, select: { id: true, name: true } });
    let party = existingParties.find((p) => p.name.trim().toLowerCase() === partyName.toLowerCase());
    if (!party) {
      party = await this.prisma.party.create({ data: { tenantId, name: partyName } });
      job.partiesCreated = 1;
    }

    // 2. Existing transaction numbers (per type) — makes re-running the same file a no-op.
    const existingTxns = await this.prisma.transaction.findMany({ where: { tenantId }, select: { number: true, type: true } });
    const seenTxnKeys = new Set(existingTxns.filter((t) => t.number).map((t) => `${t.type}:${t.number}`));

    // 3. Build + batch-insert expense transactions.
    const entries = dto.entries ?? [];
    let buffer: Array<{ tenantId: string; partyId: string; type: string; number: string; date: Date; total: number; balance: number; notes: string }> = [];

    const flush = async () => {
      if (!buffer.length) return;
      await this.prisma.transaction.createMany({ data: buffer });
      job.entriesImported += buffer.length;
      buffer = [];
    };

    for (const e of entries) {
      job.processed++;
      const date = e.date ? new Date(e.date) : null;
      const key = `expense:${e.number}`;

      if (!e.number || !date || Number.isNaN(date.getTime()) || !(e.amount > 0) || seenTxnKeys.has(key)) {
        job.entriesSkipped++;
        continue;
      }
      seenTxnKeys.add(key);

      buffer.push({
        tenantId,
        partyId: party.id,
        type: "expense",
        number: e.number,
        date,
        total: e.amount,
        // Matches PurchaseScreen's own expense notes shape exactly: { category, paymentType, items }.
        // Balance comes straight from the source file's Balance Due — this data is historical
        // and already settled (all rows show 0), unlike the manual form's always-unpaid default.
        balance: e.balance ?? e.amount,
        notes: JSON.stringify({ category: e.category, paymentType: e.paymentType, items: [], description: e.description }),
      });

      if (buffer.length >= CHUNK_SIZE) await flush();
    }
    await flush();

    job.status = "done";
  }
}
