import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateCertificationDto {
  @IsString()
  name: string;

  @IsDateString()
  issuedDate: string;

  @IsDateString()
  expiryDate: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;

  @IsOptional()
  @IsString()
  issuer?: string;
}
