import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateStoreDto {
  @IsUUID() companyId!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(40) storeType?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() address?: string;
}

// companyId is intentionally not present/updatable here — a store never moves
// between companies once created.
export class UpdateStoreDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(40) storeType?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() address?: string;
}

export class StockTransferLineDto {
  @IsUUID() itemId!: string;
  // In the item's base unit (Item.unit) — the transfer UI's "Available Qty" is shown
  // in the same base unit, so no conversion happens on this endpoint.
  @Type(() => Number) @IsNumber() @IsPositive() quantity!: number;
  @IsOptional() @IsString() unit?: string;
}

export class CreateStockTransferDto {
  @IsUUID() companyId!: string;
  @IsUUID() fromStoreId!: string;
  @IsUUID() toStoreId!: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StockTransferLineDto)
  lines!: StockTransferLineDto[];
}
