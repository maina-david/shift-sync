import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function IsNotSameAs(property: string, opts?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotSameAs',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: { message: `${propertyName} must not equal ${property}`, ...opts },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          return value !== (args.object as Record<string, unknown>)[args.constraints[0]];
        },
      },
    });
  };
}

export class CreateShiftDto {
  @ApiProperty({ example: 'uuid-of-location' })
  @IsUUID()
  locationId: string;

  @ApiProperty({ example: '2024-08-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime: string;

  @ApiProperty({ example: '23:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsNotSameAs('startTime', { message: 'endTime must not equal startTime' })
  endTime: string;

  @ApiPropertyOptional({ example: 'uuid-of-skill' })
  @IsOptional()
  @IsUUID()
  requiredSkillId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  headcount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
