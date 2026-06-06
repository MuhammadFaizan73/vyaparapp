import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreatePartyDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() billingAddress?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() shippingAddress?: string;
  @IsOptional() @IsString() shippingCity?: string;
  @IsOptional() @IsString() shippingState?: string;
  @IsOptional() @IsString() shippingPincode?: string;
  @IsOptional() @IsNumber() openingBalance?: number;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @IsOptional() @IsNumber() @Min(0) creditDays?: number;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsString() pan?: string;
  @IsOptional() @IsString() ntn?: string;
  @IsOptional() @IsString() cnic?: string;
  @IsOptional() @IsString() strn?: string;
  @IsOptional() @IsString() @IsIn(["customer", "supplier", "both"]) partyType?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}

export class UpdatePartyDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() billingAddress?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() shippingAddress?: string;
  @IsOptional() @IsString() shippingCity?: string;
  @IsOptional() @IsString() shippingState?: string;
  @IsOptional() @IsString() shippingPincode?: string;
  @IsOptional() @IsNumber() openingBalance?: number;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @IsOptional() @IsNumber() @Min(0) creditDays?: number;
  @IsOptional() @IsString() gstin?: string;
  @IsOptional() @IsString() pan?: string;
  @IsOptional() @IsString() ntn?: string;
  @IsOptional() @IsString() cnic?: string;
  @IsOptional() @IsString() strn?: string;
  @IsOptional() @IsString() @IsIn(["customer", "supplier", "both"]) partyType?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}
