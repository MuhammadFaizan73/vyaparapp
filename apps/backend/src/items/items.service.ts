import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateItemDto, UpdateItemDto } from "./items.dto";

function toRow(i: any) {
  return {
    id: i.id,
    name: i.name,
    sku: i.sku ?? null,
    unit: i.unit ?? null,
    secondaryUnit: i.secondaryUnit ?? null,
    conversionRate: i.conversionRate ?? null,
    mrp: i.mrp ?? null,
    salePrice: i.salePrice ?? null,
    purchasePrice: i.purchasePrice ?? null,
    discount: i.discount ?? null,
    openingStock: i.openingStock ?? 0,
    minStock: i.minStock ?? 0,
    companyTag: i.companyTag ?? null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const items = await this.prisma.item.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return items.map(toRow);
  }

  async create(tenantId: string, dto: CreateItemDto) {
    const item = await this.prisma.item.create({
      data: {
        tenantId,
        name: dto.name,
        sku: dto.sku ?? null,
        unit: dto.unit ?? null,
        secondaryUnit: dto.secondaryUnit ?? null,
        conversionRate: dto.conversionRate ?? null,
        mrp: dto.mrp ?? null,
        salePrice: dto.salePrice ?? null,
        purchasePrice: dto.purchasePrice ?? null,
        discount: dto.discount ?? null,
        openingStock: dto.openingStock ?? 0,
        minStock: dto.minStock ?? 0,
        companyTag: dto.companyTag ?? null,
      },
    });
    return toRow(item);
  }

  async update(tenantId: string, id: string, dto: UpdateItemDto) {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Item not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    const item = await this.prisma.item.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku || null }),
        ...(dto.unit !== undefined && { unit: dto.unit || null }),
        ...(dto.secondaryUnit !== undefined && { secondaryUnit: dto.secondaryUnit || null }),
        ...(dto.conversionRate !== undefined && { conversionRate: dto.conversionRate || null }),
        ...(dto.mrp !== undefined && { mrp: dto.mrp }),
        ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
        ...(dto.purchasePrice !== undefined && { purchasePrice: dto.purchasePrice }),
        ...(dto.discount !== undefined && { discount: dto.discount }),
        ...(dto.openingStock !== undefined && { openingStock: dto.openingStock }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.companyTag !== undefined && { companyTag: dto.companyTag || null }),
      },
    });
    return toRow(item);
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Item not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    await this.prisma.item.delete({ where: { id } });
  }
}
