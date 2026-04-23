import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePartyDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;
}
