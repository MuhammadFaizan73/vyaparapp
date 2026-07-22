import { IsArray, IsOptional, IsString } from "class-validator";

export class BulkSaleImportLineItemDto {
  name!: string;
  qty!: number;
  unit?: string;
  rate!: number;
}

export class BulkSaleImportItemDto {
  name!: string;
  unit?: string;
  sku?: string;
  salePrice?: number;
}

export class BulkSaleImportPartyDto {
  name!: string;
  phone?: string;
}

export class BulkSaleImportInvoiceDto {
  number!: string;
  date!: string;
  partyName!: string;
  transactionType!: string;
  total!: number;
  balance?: number;
  lineItems!: BulkSaleImportLineItemDto[];
}

export class BulkSaleImportRequestDto {
  @IsOptional() @IsString() companyTag?: string;
  @IsArray() items!: BulkSaleImportItemDto[];
  @IsArray() parties!: BulkSaleImportPartyDto[];
  @IsArray() invoices!: BulkSaleImportInvoiceDto[];
}

export class BulkCashFlowPartyDto {
  name!: string;
}

export class BulkCashFlowEntryDto {
  partyName!: string;
  type!: "payment_in" | "payment_out";
  date!: string;
  amount!: number;
  number?: string;
  description?: string;
}

export class BulkCashFlowImportRequestDto {
  @IsOptional() @IsString() companyTag?: string;
  @IsArray() parties!: BulkCashFlowPartyDto[];
  @IsArray() entries!: BulkCashFlowEntryDto[];
}
