import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { BulkSaleImportRequestDto } from "./bulk-import.dto";

export type BulkImportJobStatus = {
  jobId: string;
  status: "processing" | "done" | "error";
  total: number;
  processed: number;
  itemsCreated: number;
  partiesCreated: number;
  invoicesImported: number;
  invoicesSkipped: number;
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
}
