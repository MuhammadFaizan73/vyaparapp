import { IsString, Length, IsIn } from "class-validator";

export class ActivateLicenseDto {
  @IsString()
  @Length(8, 64)
  key!: string;

  @IsString()
  @IsIn(["desktop", "mobile"])
  platform!: "desktop" | "mobile";
}
