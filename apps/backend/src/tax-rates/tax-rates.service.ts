import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TaxRatesService {
  constructor(private prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.taxRate.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
  }

  create(tenantId: string, name: string, rate: number) {
    return this.prisma.taxRate.create({
      data: { tenantId, name: name.trim(), rate },
    });
  }

  async update(tenantId: string, id: string, name: string, rate: number) {
    const existing = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Tax rate not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();

    return this.prisma.taxRate.update({
      where: { id },
      data: { name: name.trim(), rate },
    });
  }

  remove(tenantId: string, id: string) {
    return this.prisma.taxRate.deleteMany({ where: { id, tenantId } });
  }
}
