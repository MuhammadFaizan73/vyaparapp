import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCompanyDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() gstin?: string;
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() gstin?: string;
}
