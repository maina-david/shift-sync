import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  desiredHoursPerWeek?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number | null;

  @ApiPropertyOptional({ description: 'Array of skill IDs to assign' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of location IDs to certify staff for',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  certifiedLocationIds?: string[];

  @ApiPropertyOptional({
    description:
      'Array of location IDs to assign manager to (manager role only)',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  managedLocationIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  notificationPreferences?: { inApp: boolean; email: boolean };
}
