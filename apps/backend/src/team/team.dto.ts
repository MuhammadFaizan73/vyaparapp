import { IsString, IsNotEmpty, IsIn, IsOptional, IsArray, IsEmail } from "class-validator";

export const VALID_ROLES = [
  "secondary_admin",
  "salesman",
  "biller",
  "biller_salesman",
  "ca_accountant",
  "stock_keeper",
  "ca_accountant_edit",
] as const;

export class CreateTeamMemberDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
  @IsOptional() @IsString() contact?: string;
  @IsString() @IsIn(VALID_ROLES) role!: string;
  @IsOptional() @IsArray() permissions?: string[];
}

export class UpdateRoleDto {
  @IsString() @IsIn(VALID_ROLES) role!: string;
}

export class UpdatePermissionsDto {
  @IsArray() permissions!: string[];
}

export class AcceptInviteDto {
  @IsString() @IsNotEmpty() token!: string;
}

export class StaffLoginDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}
