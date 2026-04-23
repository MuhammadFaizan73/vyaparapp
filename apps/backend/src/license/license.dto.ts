import { IsString, Length } from "class-validator";

export class ActivateLicenseDto {
  @IsString()
  @Length(8, 64)
  key!: string;
}
