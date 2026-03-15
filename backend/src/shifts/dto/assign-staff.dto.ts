import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignStaffDto {
  @ApiProperty({ example: 'uuid-of-user' })
  @IsUUID()
  staffId: string;

  @ApiPropertyOptional({
    description: 'Required when overriding 7th consecutive day rule',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overrideReason?: string;
}
