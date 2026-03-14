import { IsUUID, IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AutoScheduleDto {
  @ApiProperty({ description: 'Location UUID to generate the schedule for' })
  @IsUUID()
  locationId: string;

  @ApiProperty({ description: 'ISO date string for the Monday that starts the week (YYYY-MM-DD)' })
  @IsString()
  weekStart: string;

  @ApiPropertyOptional({ default: 3, description: 'Number of time slots per day (default 3)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  shiftsPerDay?: number;

  @ApiPropertyOptional({ default: 1, description: 'Minimum staff to assign per slot; slots below this threshold are recorded as unfilled' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minStaffPerShift?: number;
}
