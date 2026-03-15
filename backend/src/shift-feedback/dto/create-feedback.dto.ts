import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeedbackDto {
  @ApiProperty({ description: 'UUID of the shift assignment this feedback relates to' })
  @IsUUID()
  assignmentId: string;

  @ApiProperty({ minimum: 1, maximum: 5, description: 'Shift rating from 1 (poor) to 5 (excellent)' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ description: 'Optional free-text comment about the shift' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Was the shift adequately staffed?' })
  @IsOptional()
  @IsBoolean()
  adequatelyStaffed?: boolean;

  @ApiPropertyOptional({ description: 'Would the staff member like more shifts like this?' })
  @IsOptional()
  @IsBoolean()
  wouldRepeat?: boolean;
}
