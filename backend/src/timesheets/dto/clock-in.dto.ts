import { IsOptional, IsUUID, IsString } from 'class-validator';

export class ClockInDto {
  @IsOptional() @IsUUID() assignmentId?: string;
  @IsOptional() @IsUUID() shiftId?: string;
  /** Optional: lat,lng for geofence check (future) */
  @IsOptional() @IsString() coordinates?: string;
}
