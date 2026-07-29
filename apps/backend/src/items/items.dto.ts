import { IsString, IsOptional, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateItemDto {
  @IsString() name!: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() secondaryUnit?: string;
  @IsOptional() @IsString() conversionRate?: string;
  @IsOptional() @IsString() tertiaryUnit?: string;
  @IsOptional() @IsString() tertiaryConversionRate?: string;
  @IsOptional() @Type(() => Number) @IsNumber() mrp?: number;
  @IsOptional() @Type(() => Number) @IsNumber() salePrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() purchasePrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) openingStock?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsString() discountType?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxRate?: number;
  @IsOptional() @IsString() inclusiveOfTax?: string;
  @IsOptional() @IsString() itemLocation?: string;
  @IsOptional() @IsString() companyTag?: string;
}

export class UpdateItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() secondaryUnit?: string;
  @IsOptional() @IsString() conversionRate?: string;
  @IsOptional() @IsString() tertiaryUnit?: string;
  @IsOptional() @IsString() tertiaryConversionRate?: string;
  @IsOptional() @Type(() => Number) @IsNumber() mrp?: number;
  @IsOptional() @Type(() => Number) @IsNumber() salePrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() purchasePrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) openingStock?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minStock?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discount?: number;
  @IsOptional() @IsString() discountType?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxRate?: number;
  @IsOptional() @IsString() inclusiveOfTax?: string;
  @IsOptional() @IsString() itemLocation?: string;
  @IsOptional() @IsString() companyTag?: string;
}
