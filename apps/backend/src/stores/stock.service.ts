import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { parseTxnLineItems } from "@vyapar/shared-types";
import { toBaseQty, type ItemUnitInfo } from "../common/unit-qty.util";
import { PrismaService } from "../prisma/prisma.service";
import { StoresService } from "./stores.service";

export type ItemStockBreakdown = { storeId: string; storeName: string; quantity: number };

// sale/debit_note remove stock, purchase/credit_note add it — matches the convention
// reports.service.ts's valuation replay already uses (credit_note = Sale Return,
// debit_note = Purchase Return in this codebase's data model). Every other
// transaction type (payment_in/out, expense, opening_balance, estimates, orders,
// challans, proforma invoices) moves no stock.
const STOCK_DIRECTION: Record<string, 1 | -1> = {
  purchase: 1,
  credit_note: 1,
  sale: -1,
  debit_note: -1,
};

export const STOCK_MOVING_TYPES = new Set(Object.keys(STOCK_DIRECTION));

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoresService,
  ) {}

  async getStocksForItems(tenantId: string, itemIds: string[]): Promise<Map<string, ItemStockBreakdown[]>> {
    const map = new Map<string, ItemStockBreakdown[]>();
    if (itemIds.length === 0) return map;
    const rows = await this.prisma.itemStock.findMany({
      where: { tenantId, itemId: { in: itemIds } },
      include: { store: { select: { name: true } } },
    });
    for (const row of rows) {
      const list = map.get(row.itemId) ?? [];
      list.push({ storeId: row.storeId, storeName: row.store.name, quantity: row.quantity });
      map.set(row.itemId, list);
    }
    return map;
  }

  // dto value if it's a real store belonging to this company, else the company's
  // Main Store, else null (caller then skips movement rather than guessing).
  async resolveStoreId(tenantId: string, companyId: string | null | undefined, storeId?: string | null): Promise<string | null> {
    if (storeId) {
      const store = await this.prisma.store.findUnique({ where: { id: storeId } });
      if (store && store.tenantId === tenantId && (!companyId || store.companyId === companyId)) {
        return store.id;
      }
    }
    if (!companyId) return null;
    const main = await this.stores.mainStoreFor(tenantId, companyId);
    return main?.id ?? null;
  }

  async setStock(tx: Prisma.TransactionClient, tenantId: string, itemId: string, storeId: string, quantity: number): Promise<void> {
    await tx.itemStock.upsert({
      where: { itemId_storeId: { itemId, storeId } },
      create: { tenantId, itemId, storeId, quantity },
      update: { quantity },
    });
  }

  // Signed delta, upserting the row if absent. Never blocks negative — sales/returns
  // are allowed to drive a store negative, matching today's implicit oversell-allowed
  // behavior. Only StockTransfersService blocks on insufficient stock.
  async adjustStock(tx: Prisma.TransactionClient, tenantId: string, itemId: string, storeId: string, delta: number): Promise<void> {
    if (delta === 0) return;
    await tx.itemStock.upsert({
      where: { itemId_storeId: { itemId, storeId } },
      create: { tenantId, itemId, storeId, quantity: delta },
      update: { quantity: { increment: delta } },
    });
  }

  // sign: +1 to apply a transaction's effect (create), -1 to reverse it (update/remove).
  async applyTxnMovement(
    tx: Prisma.TransactionClient,
    tenantId: string,
    args: { type: string; storeId: string | null | undefined; notes: string | null | undefined; sign: 1 | -1 },
  ): Promise<void> {
    const dir = STOCK_DIRECTION[args.type];
    if (!dir || !args.storeId) return;
    const storeId = args.storeId;

    const lines = parseTxnLineItems(args.notes).filter((l) => !!l.itemId);
    if (lines.length === 0) return;

    const itemIds = [...new Set(lines.map((l) => l.itemId as string))];
    const items = await tx.item.findMany({
      where: { id: { in: itemIds }, tenantId },
      select: { id: true, unit: true, secondaryUnit: true, conversionRate: true, tertiaryUnit: true, tertiaryConversionRate: true },
    });
    const itemById = new Map(items.map((i) => [i.id, i as ItemUnitInfo & { id: string }]));

    for (const line of lines) {
      const item = itemById.get(line.itemId as string);
      // A cross-tenant itemId in a client payload, or an itemId for an item that's
      // since been deleted, is a no-op rather than a write.
      if (!item) continue;
      const baseQty = toBaseQty(line.qty, line.unit, item);
      const delta = dir * args.sign * baseQty;
      await this.adjustStock(tx, tenantId, item.id, storeId, delta);
    }
  }
}
