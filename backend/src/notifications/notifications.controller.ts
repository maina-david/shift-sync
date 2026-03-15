import {
  Controller,
  DefaultValuePipe,
  Get,
  MessageEvent,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { fromEvent } from 'rxjs';
import {
  NotificationsService,
  NotificationPayload,
} from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SseJwtGuard } from '../common/guards/sse-jwt.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly svc: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my notifications (paginated)' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  findAll(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.svc.findAll(user.id, limit, offset);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@CurrentUser() user: User) {
    return this.svc.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.markRead(id, user.id);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: User) {
    return this.svc.markAllRead(user.id);
  }

  @Sse('stream')
  @UseGuards(SseJwtGuard)
  @ApiOperation({
    summary: 'SSE — real-time notification stream for the authenticated user',
  })
  @ApiQuery({ name: 'token', required: true })
  stream(@CurrentUser() user: User): Observable<MessageEvent> {
    return fromEvent<NotificationPayload>(
      this.eventEmitter,
      'notification.send',
    ).pipe(
      filter((payload) => payload.userId === user.id),
      map((payload) => ({ data: payload }) as MessageEvent),
    );
  }
}
