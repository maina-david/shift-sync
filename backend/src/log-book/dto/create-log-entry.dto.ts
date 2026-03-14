import { IsDateString, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLogEntryDto {
  @ApiProperty({ example: '2025-07-14' })
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  note: string;
}
