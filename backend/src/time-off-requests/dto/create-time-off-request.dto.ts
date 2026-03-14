import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTimeOffRequestDto {
  @ApiProperty({ example: '2025-07-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-07-05' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
