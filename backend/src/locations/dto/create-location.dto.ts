import { IsString, IsTimeZone, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({ example: 'North Beach' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'America/Los_Angeles' })
  @IsString()
  @IsTimeZone()
  @MaxLength(64)
  timezone: string;

  @ApiProperty({ example: '123 Ocean Dr, San Francisco, CA' })
  @IsString()
  @MaxLength(255)
  address: string;
}
