import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'jane@coastaleats.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'securepassword', minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.STAFF })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
