import { IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PublishWeekDto {
  @ApiProperty({ example: 'uuid-of-location' })
  @IsUUID()
  locationId: string;

  @ApiProperty({
    description: 'Monday of the week to publish',
    example: '2024-08-12',
  })
  @IsDateString()
  weekStart: string;
}
