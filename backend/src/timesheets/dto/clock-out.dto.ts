import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class ClockOutDto {
  @IsOptional() @IsInt() @Min(0) @Max(1440) breakMinutes?: number;
}
