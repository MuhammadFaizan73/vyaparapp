import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateTransactionDto {
  @IsString() partyId!: string;
  @IsString() @IsIn(["sale","purchase","payment_in","payment_out","credit_note","debit_note","expense","opening_balance","estimate","proforma_invoice","sale_order","purchase_order","delivery_challan"]) type!: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsNumber() total!: number;
  @IsNumber() balance!: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateTransactionDto {
  @IsOptional() @IsUUID() partyId?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsNumber() total?: number;
  @IsOptional() @IsNumber() balance?: number;
  @IsOptional() @IsString() notes?: string;
}
