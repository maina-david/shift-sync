import { IsString, IsEmail, IsOptional, IsInt, IsDateString, Matches, MaxLength, Min, Max, IsUUID } from 'class-validator';

export class CreateReservationDto {
  @IsString() @MaxLength(100) customerName: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsDateString() date: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:mm' }) time: string;
  @IsInt() @Min(1) @Max(20) partySize: number;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
