import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { ReservationStatus } from '../entities/reservation.entity';

export class UpdateReservationDto {
  @IsOptional() @IsEnum(ReservationStatus) status?: ReservationStatus;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
