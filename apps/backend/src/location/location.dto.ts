import { IsNumber, IsOptional, IsString, Min, Max } from "class-validator";

export class PingLocationDto {
  @IsNumber()
  @Min(-90) @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180) @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;
}

export class CheckInDto {
  @IsNumber()
  @Min(-90) @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180) @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  partyId?: string;

  @IsOptional()
  @IsString()
  partyName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CheckOutDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ShopCheckInDto {
  @IsString() partyId!: string;
  @IsString() partyName!: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsString() notes?: string;
}
