import {
  IsString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';
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
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
