import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { MessageType } from '../entities/message.entity';

export class SendMessageDto {
  @IsEnum(MessageType)
  type: MessageType;

  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsString()
  body: string;
}
