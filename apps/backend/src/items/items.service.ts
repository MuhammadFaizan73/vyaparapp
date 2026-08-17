import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StockService, type ItemStockBreakdown } from "../stores/stock.service";
import { StoresService } from "../stores/stores.service";
import { CreateItemDto, UpdateItemDto } from "./items.dto";

function toRow(i: any, stocks: ItemStockBreakdown[]) {
  const totalStock = stocks.length > 0 ? stocks.reduce((sum, s) => sum + s.quantity, 0) : i.openingStock ?? 0;
  return {
    id: i.id,
    name: i.name,
    sku: i.sku ?? null,
    category: i.category ?? null,
    unit: i.unit ?? null,
    secondaryUnit: i.secondaryUnit ?? null,
    conversionRate: i.conversionRate ?? null,
    tertiaryUnit: i.tertiaryUnit ?? null,
    tertiaryConversionRate: i.tertiaryConversionRate ?? null,
    mrp: i.mrp ?? null,
    salePrice: i.salePrice ?? null,
    purchasePrice: i.purchasePrice ?? null,
    discount: i.discount ?? null,
    discountType: i.discountType ?? null,
    taxRate: i.taxRate ?? null,
    inclusiveOfTax: i.inclusiveOfTax ?? null,
    itemLocation: i.itemLocation ?? null,
    openingStock: i.openingStock ?? 0,
    minStock: i.minStock ?? 0,
    companyTag: i.companyTag ?? null,
    companyId: i.companyId ?? null,
    stocks: stocks.map((s) => ({ storeId: s.storeId, storeName: s.storeName, quantity: s.quantity })),
    totalStock,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoresService,
    private readonly stock: StockService,
  ) {}

  async list(tenantId: string, opts: { companyId?: string } = {}) {
    await this.stores.ensureBootstrapped(tenantId);
    const items = await this.prisma.item.findMany({
      where: { tenantId, ...(opts.companyId ? { companyId: opts.companyId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    const stocksByItem = await this.stock.getStocksForItems(tenantId, items.map((i) => i.id));
    return items.map((i) => toRow(i, stocksByItem.get(i.id) ?? []));
  }

  async create(tenantId: string, dto: CreateItemDto) {
    // Resolved before the write transaction — resolveStoreId can trigger
    // StoresService.ensureBootstrapped, which opens its own $transaction; nesting
    // that inside this one would fight it for SQLite's single writer lock.
    const storeId = await this.stock.resolveStoreId(tenantId, dto.companyId ?? null, dto.storeId);

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: {
          tenantId,
          name: dto.name,
          sku: dto.sku ?? null,
          category: dto.category ?? null,
          unit: dto.unit ?? null,
          secondaryUnit: dto.secondaryUnit ?? null,
          conversionRate: dto.conversionRate ?? null,
          tertiaryUnit: dto.tertiaryUnit ?? null,
          tertiaryConversionRate: dto.tertiaryConversionRate ?? null,
          mrp: dto.mrp ?? null,
          salePrice: dto.salePrice ?? null,
          purchasePrice: dto.purchasePrice ?? null,
          discount: dto.discount ?? null,
          discountType: dto.discountType ?? null,
          taxRate: dto.taxRate ?? null,
          inclusiveOfTax: dto.inclusiveOfTax ?? null,
          itemLocation: dto.itemLocation ?? null,
          openingStock: dto.openingStock ?? 0,
          minStock: dto.minStock ?? 0,
          companyTag: dto.companyTag ?? null,
          companyId: dto.companyId ?? null,
        },
      });
      if (storeId) {
        await this.stock.setStock(tx, tenantId, created.id, storeId, dto.openingStock ?? 0);
      }
      return created;
    });

    const stocksByItem = await this.stock.getStocksForItems(tenantId, [item.id]);
    return toRow(item, stocksByItem.get(item.id) ?? []);
  }

  async update(tenantId: string, id: string, dto: UpdateItemDto) {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Item not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();

    // Only resolve/write stock when openingStock is actually part of this edit —
    // a price-only edit must never touch a store's live quantity.
    let storeId: string | null = null;
    if (dto.openingStock !== undefined) {
      const companyId = dto.companyId !== undefined ? dto.companyId || null : existing.companyId;
      storeId = await this.stock.resolveStoreId(tenantId, companyId, dto.storeId);
    }

    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.sku !== undefined && { sku: dto.sku || null }),
          ...(dto.category !== undefined && { category: dto.category || null }),
          ...(dto.unit !== undefined && { unit: dto.unit || null }),
          ...(dto.secondaryUnit !== undefined && { secondaryUnit: dto.secondaryUnit || null }),
          ...(dto.conversionRate !== undefined && { conversionRate: dto.conversionRate || null }),
          ...(dto.tertiaryUnit !== undefined && { tertiaryUnit: dto.tertiaryUnit || null }),
          ...(dto.tertiaryConversionRate !== undefined && { tertiaryConversionRate: dto.tertiaryConversionRate || null }),
          ...(dto.mrp !== undefined && { mrp: dto.mrp }),
          ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
          ...(dto.purchasePrice !== undefined && { purchasePrice: dto.purchasePrice }),
          ...(dto.discount !== undefined && { discount: dto.discount }),
          ...(dto.discountType !== undefined && { discountType: dto.discountType || null }),
          ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
          ...(dto.inclusiveOfTax !== undefined && { inclusiveOfTax: dto.inclusiveOfTax || null }),
          ...(dto.itemLocation !== undefined && { itemLocation: dto.itemLocation || null }),
          ...(dto.openingStock !== undefined && { openingStock: dto.openingStock }),
          ...(dto.minStock !== undefined && { minStock: dto.minStock }),
          ...(dto.companyTag !== undefined && { companyTag: dto.companyTag || null }),
          ...(dto.companyId !== undefined && { companyId: dto.companyId || null }),
        },
      });
      if (storeId && dto.openingStock !== undefined) {
        await this.stock.setStock(tx, tenantId, id, storeId, dto.openingStock);
      }
      return updated;
    });

    const stocksByItem = await this.stock.getStocksForItems(tenantId, [item.id]);
    return toRow(item, stocksByItem.get(item.id) ?? []);
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Item not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    await this.prisma.item.delete({ where: { id } });
  }
}
