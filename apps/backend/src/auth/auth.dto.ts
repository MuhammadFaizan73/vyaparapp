import { IsString, Length, Matches, IsOptional } from "class-validator";

export class RegisterDto {
  @IsString()
  @Matches(/^\+\d{1,4}$/, { message: "countryCode must be like +92" })
  countryCode!: string;

  @IsString()
  @Length(6, 15)
  @Matches(/^\d+$/, { message: "phone must contain only digits" })
  phone!: string;
}

export class UpdateTenantDto {
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() companyEmail?: string;
  @IsOptional() @IsString() extraCompanies?: string;
}
