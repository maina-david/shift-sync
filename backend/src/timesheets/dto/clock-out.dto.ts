import { IsOptional, IsInt, Min } from 'class-validator';

export class ClockOutDto {
  @IsOptional() @IsInt() @Min(0) breakMinutes?: number;
}
