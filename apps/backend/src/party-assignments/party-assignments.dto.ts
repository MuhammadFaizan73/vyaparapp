import { IsString, IsArray, ArrayNotEmpty } from "class-validator";

export class CreateAssignmentDto {
  @IsString() partyId!: string;
  @IsString() memberId!: string;
  @IsArray() @ArrayNotEmpty() visitDays!: string[]; // ["Mon","Wed","Fri"]
}

export class UpdateAssignmentDto {
  @IsArray() @ArrayNotEmpty() visitDays!: string[];
}
