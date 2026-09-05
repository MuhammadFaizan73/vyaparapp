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
  @IsOptional() @IsEmail() email?: string;
  @IsString() @IsNotEmpty() password!: string;
  @IsOptional() @IsString() contact?: string;
  @IsString() @IsIn(VALID_ROLES) role!: string;
  @IsOptional() @IsArray() permissions?: string[];
  @IsOptional() @IsArray() allowedReports?: string[];
  // Omitted/undefined = unrestricted (sees every company). A non-empty array restricts
  // this member to exactly those Company ids.
  @IsOptional() @IsArray() companyIds?: string[];
}

export class UpdateRoleDto {
  @IsString() @IsIn(VALID_ROLES) role!: string;
}

export class UpdatePermissionsDto {
  @IsArray() permissions!: string[];
  @IsOptional() @IsArray() allowedReports?: string[];
  // Tri-state: field omitted -> leave companyIds untouched; explicit null -> clear the
  // restriction (unrestricted); an array -> set the restriction to exactly those ids.
  @IsOptional() @IsArray() companyIds?: string[] | null;
}

export class AcceptInviteDto {
  @IsString() @IsNotEmpty() token!: string;
}

export class StaffLoginDto {
  @IsOptional() @IsString() identifier?: string; // email or phone
  @IsString() @IsNotEmpty() password!: string;
}
