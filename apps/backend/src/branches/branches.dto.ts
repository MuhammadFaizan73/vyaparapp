import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateBranchDto {
  @IsString() distributorId!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() city?: string;
}

export class UpdateBranchDto {
  @IsOptional() @IsString() distributorId?: string;
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() city?: string;
}
