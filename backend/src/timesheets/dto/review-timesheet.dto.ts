import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TimesheetStatus } from '../entities/timesheet.entity';

export class ReviewTimesheetDto {
  @IsEnum([TimesheetStatus.APPROVED, TimesheetStatus.REJECTED])
  status: TimesheetStatus.APPROVED | TimesheetStatus.REJECTED;

  @IsOptional() @IsString() managerNote?: string;
}
