import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

// One entry in `allocations` — how much of this payment was applied against a
// specific invoice transaction. See PaymentAllocation in schema.prisma.
export class PaymentAllocationInputDto {
  @IsUUID() invoiceId!: string;
  @IsNumber() amount!: number;
}

export class CreateTransactionDto {
  @IsString() partyId!: string;
  @IsString() @IsIn(["sale","purchase","payment_in","payment_out","credit_note","debit_note","expense","opening_balance","estimate","proforma_invoice","sale_order","purchase_order","delivery_challan"]) type!: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsNumber() total!: number;
  @IsNumber() balance!: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() bookerId?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
  @IsOptional() @IsUUID() storeId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentAllocationInputDto) allocations?: PaymentAllocationInputDto[];
}

export class UpdateTransactionDto {
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsNumber() total?: number;
  @IsOptional() @IsNumber() balance?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsUUID() bookerId?: string;
  @IsOptional() @IsUUID() storeId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentAllocationInputDto) allocations?: PaymentAllocationInputDto[];
}
