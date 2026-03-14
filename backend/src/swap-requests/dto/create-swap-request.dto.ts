import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSwapRequestDto {
  @ApiProperty({ description: 'ID of the assignment you want to give away' })
  @IsUUID()
  fromAssignmentId: string;

  @ApiProperty({ description: 'ID of the staff member you want to swap with' })
  @IsUUID()
  toUserId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
