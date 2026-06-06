import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateLoanAccountDto {
  accountName: string;
  lenderBank?: string;
  accountNumber?: string;
  description?: string;
  currentBalance: number;
  balanceAsOf: string;
  loanReceivedIn?: string;
  interestRate?: number;
  termDuration?: number;
  processingFee?: number;
  processingFeePaidFrom?: string;
}

@Injectable()
export class LoanAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.loanAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(tenantId: string, dto: CreateLoanAccountDto) {
    return this.prisma.loanAccount.create({
      data: {
        tenantId,
        accountName: dto.accountName,
        lenderBank: dto.lenderBank,
        accountNumber: dto.accountNumber,
        description: dto.description,
        currentBalance: dto.currentBalance,
        balanceAsOf: new Date(dto.balanceAsOf),
        loanReceivedIn: dto.loanReceivedIn ?? "Cash",
        interestRate: dto.interestRate,
        termDuration: dto.termDuration,
        processingFee: dto.processingFee,
        processingFeePaidFrom: dto.processingFeePaidFrom ?? "Cash",
      },
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateLoanAccountDto>) {
    const existing = await this.prisma.loanAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Loan account not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    return this.prisma.loanAccount.update({
      where: { id },
      data: {
        ...dto,
        balanceAsOf: dto.balanceAsOf ? new Date(dto.balanceAsOf) : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.loanAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Loan account not found");
    if (existing.tenantId !== tenantId) throw new ForbiddenException();
    return this.prisma.loanAccount.delete({ where: { id } });
  }
}
