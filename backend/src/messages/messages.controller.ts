import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Send a direct message or announcement' })
  send(@Body() dto: SendMessageDto, @CurrentUser() user: User) {
    return this.svc.send(user.id, user.role, dto);
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Get my inbox (latest thread messages + announcements)' })
  getInbox(@CurrentUser() user: User) {
    // Pass the first certified location id if present, for announcement scoping
    const locationId =
      user.certifiedLocations && user.certifiedLocations.length > 0
        ? user.certifiedLocations[0].id
        : undefined;
    return this.svc.getInbox(user.id, locationId);
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Get announcements, optionally scoped to a location' })
  @ApiQuery({ name: 'locationId', required: false })
  getAnnouncements(@Query('locationId') locationId?: string) {
    return this.svc.getAnnouncements(locationId);
  }

  @Get('thread/:userId')
  @ApiOperation({ summary: 'Get direct message thread with another user' })
  getThread(@Param('userId') otherUserId: string, @CurrentUser() user: User) {
    return this.svc.getDirectThread(user.id, otherUserId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all direct messages to me as read' })
  markAllRead(@CurrentUser() user: User) {
    return this.svc.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a specific message as read' })
  markRead(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.markRead(id, user.id);
  }
}
