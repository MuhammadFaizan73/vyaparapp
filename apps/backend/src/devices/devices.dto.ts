import { IsString, IsIn, Length } from "class-validator";

export class RegisterDeviceDto {
  @IsString()
  @Length(4, 64)
  deviceId!: string;

  @IsString()
  @Length(1, 100)
  deviceName!: string;

  @IsString()
  @IsIn(["mobile", "desktop", "web"])
  deviceType!: string;
}
