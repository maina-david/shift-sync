import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsOptional,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TemplateShiftDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:MM' })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be HH:MM' })
  endTime: string;

  @IsOptional()
  @IsUUID()
  requiredSkillId?: string | null;

  @IsInt()
  @Min(1)
  headcount: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateScheduleTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  locationId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateShiftDto)
  shifts: TemplateShiftDto[];
}
