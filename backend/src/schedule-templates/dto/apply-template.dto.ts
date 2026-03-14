import { IsString, IsUUID } from 'class-validator';

export class ApplyTemplateDto {
  @IsUUID()
  templateId: string;

  @IsString()
  weekStart: string; // YYYY-MM-DD Monday
}
