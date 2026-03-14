import { IsString, MaxLength } from 'class-validator';

export class CreateBookmarkDto {
  @IsString()
  @MaxLength(100)
  label: string;

  @IsString()
  @MaxLength(200)
  href: string;
}
