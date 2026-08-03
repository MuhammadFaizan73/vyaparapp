import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDistributorDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
}

export class UpdateDistributorDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
}
