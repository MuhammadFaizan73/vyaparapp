import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateStoreDto, UpdateStoreDto } from "./stores.dto";

export type StoreRow = {
  id: string;
  companyId: string;
  name: string;
  storeType: string | null;
  phone: string | null;
  email: string | null;
  pincode: string | null;
  address: string | null;
  isMain: boolean;
  createdAt: string;
};

function toRow(s: {
  id: string; companyId: string; name: string; storeType: string | null;
  phone: string | null; email: string | null; pincode: string | null;
  address: string | null; isMain: boolean; createdAt: Date;
}): StoreRow {
  return {
    id: s.id,
    companyId: s.companyId,
    name: s.name,
    storeType: s.storeType,
    phone: s.phone,
    email: s.email,
    pincode: s.pincode,
    address: s.address,
    isMain: s.isMain,
    createdAt: s.createdAt.toISOString(),
  };
}

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotent backfill: every company under this tenant ends up with exactly one
  // Main Store, seeded from each of its items' current openingStock. Called from
  // list()/mainStoreFor() so it self-runs on first touch — there is no migration
  // file that could do this in prod (db push only, never `prisma migrate`).
  async ensureBootstrapped(tenantId: string): Promise<void> {
    const companies = await this.prisma.company.findMany({ where: { tenantId }, select: { id: true } });
    if (companies.length === 0) return;

    const existing = await this.prisma.store.findMany({ where: { tenantId }, select: { companyId: true } });
    const companiesWithStores = new Set(existing.map((s) => s.companyId));
    const toBootstrap = companies.filter((c) => !companiesWithStores.has(c.id));

    for (const company of toBootstrap) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const store = await tx.store.create({
            data: { tenantId, companyId: company.id, name: "Main Store", storeType: "Store", isMain: true },
          });
          const items = await tx.item.findMany({
            where: { tenantId, companyId: company.id },
            select: { id: true, openingStock: true },
          });
          if (items.length > 0) {
            await tx.itemStock.createMany({
              data: items.map((i) => ({ tenantId, itemId: i.id, storeId: store.id, quantity: i.openingStock ?? 0 })),
            });
          }
        });
      } catch (err: any) {
        // A concurrent request may have bootstrapped this same company between our
        // read above and this write. dedupeMainStores below cleans up either outcome.
        if (err?.code !== "P2002") throw err;
      }
    }

    // Self-heal a rare double-bootstrap race instead of requiring a DB-level "at most
    // one true per companyId" constraint, which Prisma can't express portably across
    // SQLite/Postgres without raw SQL.
    for (const company of companies) {
      await this.dedupeMainStores(tenantId, company.id);
    }

    // Legacy items with no company at all: attach to the tenant's sole company's Main
    // Store when unambiguous; with more than one company, leave unassigned rather
    // than guessing which company they belong to.
    if (companies.length === 1) {
      await this.seedLegacyUnassignedItems(tenantId, companies[0].id);
    }
  }

  private async dedupeMainStores(tenantId: string, companyId: string): Promise<void> {
    const mains = await this.prisma.store.findMany({
      where: { tenantId, companyId, isMain: true },
      orderBy: { createdAt: "asc" },
    });
    if (mains.length <= 1) return;
    const [keep, ...extras] = mains;
    for (const dup of extras) {
      const rows = await this.prisma.itemStock.findMany({ where: { storeId: dup.id } });
      for (const row of rows) {
        await this.prisma.itemStock.upsert({
          where: { itemId_storeId: { itemId: row.itemId, storeId: keep.id } },
          create: { tenantId, itemId: row.itemId, storeId: keep.id, quantity: row.quantity },
          update: { quantity: { increment: row.quantity } },
        });
      }
      await this.prisma.store.delete({ where: { id: dup.id } });
    }
  }

  private async seedLegacyUnassignedItems(tenantId: string, companyId: string): Promise<void> {
    const legacyItems = await this.prisma.item.findMany({
      where: { tenantId, companyId: null },
      select: { id: true, openingStock: true },
    });
    if (legacyItems.length === 0) return;
    const mainStore = await this.prisma.store.findFirst({ where: { tenantId, companyId, isMain: true } });
    if (!mainStore) return;

    const alreadyStocked = new Set(
      (
        await this.prisma.itemStock.findMany({
          where: { itemId: { in: legacyItems.map((i) => i.id) } },
          select: { itemId: true },
        })
      ).map((r) => r.itemId),
    );
    const toSeed = legacyItems.filter((i) => !alreadyStocked.has(i.id));
    if (toSeed.length === 0) return;

    try {
      await this.prisma.itemStock.createMany({
        data: toSeed.map((i) => ({ tenantId, itemId: i.id, storeId: mainStore.id, quantity: i.openingStock ?? 0 })),
      });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
    }
  }

  private async assertCompanyOwned(tenantId: string, companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company || company.tenantId !== tenantId) throw new NotFoundException("Company not found");
  }

  async list(tenantId: string, companyId?: string): Promise<StoreRow[]> {
    await this.ensureBootstrapped(tenantId);
    const stores = await this.prisma.store.findMany({
      where: { tenantId, ...(companyId ? { companyId } : {}) },
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
    });
    return stores.map(toRow);
  }

  async create(tenantId: string, dto: CreateStoreDto): Promise<StoreRow> {
    await this.assertCompanyOwned(tenantId, dto.companyId);
    const name = dto.name.trim();
    const dup = await this.prisma.store.findFirst({ where: { tenantId, companyId: dto.companyId, name } });
    if (dup) throw new ConflictException(`A store named "${name}" already exists in this company`);

    const store = await this.prisma.store.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        name,
        storeType: dto.storeType ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        pincode: dto.pincode ?? null,
        address: dto.address ?? null,
        isMain: false,
      },
    });
    return toRow(store);
  }

  async update(tenantId: string, id: string, dto: UpdateStoreDto): Promise<StoreRow> {
    const existing = await this.prisma.store.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) throw new NotFoundException("Store not found");

    const store = await this.prisma.store.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.storeType !== undefined && { storeType: dto.storeType || null }),
        ...(dto.phone !== undefined && { phone: dto.phone || null }),
        ...(dto.email !== undefined && { email: dto.email || null }),
        ...(dto.pincode !== undefined && { pincode: dto.pincode || null }),
        ...(dto.address !== undefined && { address: dto.address || null }),
      },
    });
    return toRow(store);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.store.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) throw new NotFoundException("Store not found");
    if (existing.isMain) throw new ConflictException("The main store can't be deleted");

    const stockCount = await this.prisma.itemStock.count({ where: { storeId: id, quantity: { not: 0 } } });
    if (stockCount > 0) throw new ConflictException("Move this store's stock out before deleting it");

    const transferCount = await this.prisma.stockTransfer.count({
      where: { OR: [{ fromStoreId: id }, { toStoreId: id }] },
    });
    if (transferCount > 0) throw new ConflictException("This store has stock transfers recorded against it");

    const txnCount = await this.prisma.transaction.count({ where: { storeId: id } });
    if (txnCount > 0) throw new ConflictException("This store has transactions recorded against it");

    await this.prisma.store.delete({ where: { id } });
  }

  async mainStoreFor(tenantId: string, companyId: string): Promise<StoreRow | null> {
    await this.ensureBootstrapped(tenantId);
    const store = await this.prisma.store.findFirst({ where: { tenantId, companyId, isMain: true } });
    return store ? toRow(store) : null;
  }

  async assertStoreInCompany(tenantId: string, companyId: string, storeId: string): Promise<void> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.tenantId !== tenantId) throw new NotFoundException("Store not found");
    if (store.companyId !== companyId) throw new BadRequestException("Store does not belong to this company");
  }
}
