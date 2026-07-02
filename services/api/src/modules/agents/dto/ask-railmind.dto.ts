import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AskRailMindDto {
  @ApiProperty({ description: "Question to ask RailMind", example: "Why is Signal S11 unstable?" })
  @IsString()
  @IsNotEmpty({ message: "question must not be empty" })
  @MinLength(5, { message: "question must be at least 5 characters" })
  @MaxLength(500, { message: "question must not exceed 500 characters" })
  question: string;

  @ApiProperty({ description: "Optional asset ID to scope the investigation", required: false })
  @IsOptional()
  @IsString()
  assetId?: string;
}
