import { IsString, Length, IsIn, IsEmail, IsOptional, ValidateIf } from "class-validator";

export class ActivateLicenseDto {
  // Exactly one of key/licenseId is required — key for a customer who already has one
  // (e.g. handed to them by a reseller), licenseId when they picked one from the list
  // LookupLicensesDto returns for their email.
  @ValidateIf((o) => !o.licenseId) @IsString() @Length(8, 64) key?: string;
  @ValidateIf((o) => !o.key) @IsString() licenseId?: string;

  @IsEmail() email!: string;

  @IsString()
  @IsIn(["desktop", "mobile"])
  platform!: "desktop" | "mobile";
}

export class LookupLicensesDto {
  @IsEmail() email!: string;
}
