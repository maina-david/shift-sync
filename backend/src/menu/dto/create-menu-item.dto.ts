import { IsString, IsNumber, IsOptional, IsBoolean, IsInt, IsIn, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateMenuItemDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsNumber() @Min(0) price: number;
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @IsOptional() @IsString() @MaxLength(50) tag?: string;
  @IsOptional() @IsIn(['cyan', 'violet', 'pink']) tagColor?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
  @IsOptional() @IsBoolean() isTodaysHighlight?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsUUID() locationId?: string;
}
