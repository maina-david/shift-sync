import { Controller, Get, MessageEvent, Query, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Observable, from, interval } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SseJwtGuard } from '../common/guards/sse-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Hours distribution per staff member over a date range' })
  @ApiQuery({ name: 'startDate', example: '2024-08-01' })
  @ApiQuery({ name: 'endDate', example: '2024-08-31' })
  @ApiQuery({ name: 'locationId', required: false })
  hoursDistribution(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('locationId') locationId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.getHoursDistribution(startDate, endDate, locationId, user);
  }

  @Get('fairness')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Premium shift fairness report — set crossLocation=true to aggregate all locations per staff member' })
  @ApiQuery({ name: 'startDate', example: '2024-08-01' })
  @ApiQuery({ name: 'endDate', example: '2024-08-31' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'crossLocation', required: false, description: 'When true, computes each staff member\'s premium ratio across all locations, not just the selected one' })
  fairness(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('locationId') locationId: string,
    @Query('crossLocation') crossLocation: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.getFairnessReport(startDate, endDate, locationId, user, crossLocation === 'true');
  }

  @Get('overtime')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Projected overtime for a week — highlights overtime-causing assignments' })
  @ApiQuery({ name: 'weekStart', description: 'Monday of the target week', example: '2024-08-12' })
  @ApiQuery({ name: 'locationId', required: false })
  overtime(
    @Query('weekStart') weekStart: string,
    @Query('locationId') locationId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.getOvertimeProjection(weekStart, locationId, user);
  }

  @Sse('live')
  @UseGuards(SseJwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'SSE — live dashboard stats stream (refreshed every 30 s)' })
  @ApiQuery({ name: 'token', required: true })
  liveStats(): Observable<MessageEvent> {
    return interval(30_000).pipe(
      startWith(0),
      switchMap(() => from(this.svc.getLiveSnapshot())),
      map((snapshot) => ({ data: snapshot }) as MessageEvent),
    );
  }
}
