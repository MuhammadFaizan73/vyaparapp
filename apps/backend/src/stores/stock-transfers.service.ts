import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "./stock.service";
import { StoresService } from "./stores.service";
import { CreateStockTransferDto } from "./stores.dto";

export type StockTransferLineRow = {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string | null;
  unit: string | null;
  quantity: number;
};

export type StockTransferRow = {
  id: string;
  companyId: string;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  date: string;
  number: string | null;
  notes: string | null;
  lines: StockTransferLineRow[];
  totalQty: number;
  createdAt: string;
};

const transferInclude = {
  fromStore: { select: { name: true } },
  toStore: { select: { name: true } },
  lines: true,
} as const;

type TransferWithRelations = {
  id: string; companyId: string; fromStoreId: string; toStoreId: string;
  date: Date; number: string | null; notes: string | null; createdAt: Date;
  fromStore: { name: string }; toStore: { name: string };
  lines: { id: string; itemId: string; itemName: string; itemSku: string | null; unit: string | null; quantity: number }[];
};

function toRow(t: TransferWithRelations): StockTransferRow {
  return {
    id: t.id,
    companyId: t.companyId,
    fromStoreId: t.fromStoreId,
    fromStoreName: t.fromStore.name,
    toStoreId: t.toStoreId,
    toStoreName: t.toStore.name,
    date: t.date.toISOString(),
    number: t.number,
    notes: t.notes,
    lines: t.lines.map((l) => ({ id: l.id, itemId: l.itemId, itemName: l.itemName, itemSku: l.itemSku, unit: l.unit, quantity: l.quantity })),
    totalQty: t.lines.reduce((sum, l) => sum + l.quantity, 0),
    createdAt: t.createdAt.toISOString(),
  };
}

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoresService,
    private readonly stock: StockService,
  ) {}

  async list(tenantId: string, opts: { companyId?: string; take?: number; from?: string; to?: string } = {}): Promise<StockTransferRow[]> {
    const take = opts.take && opts.take > 0 ? Math.min(opts.take, 200) : 100;
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (opts.from) dateFilter.gte = new Date(opts.from);
    if (opts.to) dateFilter.lte = new Date(opts.to);

    const transfers = await this.prisma.stockTransfer.findMany({
      where: {
        tenantId,
        ...(opts.companyId ? { companyId: opts.companyId } : {}),
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      },
      include: transferInclude,
      orderBy: { date: "desc" },
      take,
    });
    return transfers.map(toRow);
  }

  async findOne(tenantId: string, id: string): Promise<StockTransferRow> {
    const transfer = await this.prisma.stockTransfer.findUnique({ where: { id }, include: transferInclude });
    if (!transfer || transfer.tenantId !== tenantId) throw new NotFoundException("Stock transfer not found");
    return toRow(transfer);
  }

  async create(tenantId: string, dto: CreateStockTransferDto): Promise<StockTransferRow> {
    if (dto.fromStoreId === dto.toStoreId) {
      throw new BadRequestException("Source and destination store must be different");
    }
    await this.stores.assertStoreInCompany(tenantId, dto.companyId, dto.fromStoreId);
    await this.stores.assertStoreInCompany(tenantId, dto.companyId, dto.toStoreId);

    // Collapse duplicate itemId lines by summing — the UI never sends duplicates, but
    // this keeps the stock math correct if it ever does.
    const collapsed = new Map<string, { quantity: number; unit?: string }>();
    for (const line of dto.lines) {
      const existing = collapsed.get(line.itemId);
      collapsed.set(line.itemId, { quantity: (existing?.quantity ?? 0) + line.quantity, unit: existing?.unit ?? line.unit });
    }
    const itemIds = [...collapsed.keys()];

    const items = await this.prisma.item.findMany({ where: { id: { in: itemIds }, tenantId } });
    const itemById = new Map(items.map((i) => [i.id, i]));
    for (const itemId of itemIds) {
      if (!itemById.has(itemId)) throw new BadRequestException("One or more items were not found");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const stockRows = await tx.itemStock.findMany({
        where: { tenantId, storeId: dto.fromStoreId, itemId: { in: itemIds } },
      });
      const availableByItem = new Map(stockRows.map((r) => [r.itemId, r.quantity]));

      for (const [itemId, { quantity }] of collapsed) {
        const available = availableByItem.get(itemId) ?? 0;
        if (quantity > available) {
          const item = itemById.get(itemId)!;
          throw new BadRequestException(
            `Not enough stock of "${item.name}" at the source store (available ${available}, requested ${quantity})`,
          );
        }
      }

      for (const [itemId, { quantity }] of collapsed) {
        await this.stock.adjustStock(tx, tenantId, itemId, dto.fromStoreId, -quantity);
        await this.stock.adjustStock(tx, tenantId, itemId, dto.toStoreId, quantity);
      }

      return tx.stockTransfer.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          fromStoreId: dto.fromStoreId,
          toStoreId: dto.toStoreId,
          date: dto.date ? new Date(dto.date) : undefined,
          number: dto.number ?? null,
          notes: dto.notes ?? null,
          lines: {
            create: [...collapsed.entries()].map(([itemId, { quantity, unit }]) => {
              const item = itemById.get(itemId)!;
              return { itemId, itemName: item.name, itemSku: item.sku ?? null, unit: unit ?? item.unit ?? null, quantity };
            }),
          },
        },
        include: transferInclude,
      });
    });

    return toRow(created);
  }
}
