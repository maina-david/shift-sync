import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChecklistType } from '../entities/checklist.entity';

export class ChecklistItemDto {
  @ApiProperty({ description: 'Human-readable label for this checklist item' })
  @IsString()
  label: string;

  @ApiProperty({ description: 'Whether this item must be completed before the checklist is considered done' })
  @IsBoolean()
  required: boolean;
}

export class CreateChecklistDto {
  @ApiProperty({ enum: ChecklistType, description: 'Type of checklist' })
  @IsEnum(ChecklistType)
  type: ChecklistType;

  @ApiProperty({ description: 'Display title for the checklist' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'UUID of the location this checklist belongs to' })
  @IsUUID()
  locationId: string;

  @ApiPropertyOptional({ description: 'UUID of the shift this checklist is tied to' })
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional({ description: 'UUID of the staff member assigned to complete this checklist' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiProperty({ type: [ChecklistItemDto], description: 'Ordered list of checklist items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items: ChecklistItemDto[];
}
