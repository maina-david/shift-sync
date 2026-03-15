import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  MessageEvent,
  Sse,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SseJwtGuard } from '../common/guards/sse-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { ShiftStatus } from './entities/shift.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { AssignStaffDto } from './dto/assign-staff.dto';
import { PublishWeekDto } from './dto/publish-week.dto';
import { AutoScheduleDto } from './dto/auto-schedule.dto';

@ApiTags('shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(
    private readonly svc: ShiftsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Sse('stream')
  @UseGuards(SseJwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'SSE — real-time schedule-change stream' })
  @ApiQuery({ name: 'token', required: true })
  scheduleStream(@CurrentUser() user: User): Observable<MessageEvent> {
    const managedIds = new Set((user.managedLocations ?? []).map((l) => l.id));
    const isAdmin = user.role === UserRole.ADMIN;

    return fromEvent<{
      locationId?: string;
      shiftId?: string;
      weekStart?: string;
    }>(this.eventEmitter, 'schedule.updated').pipe(
      filter(
        (payload) =>
          isAdmin ||
          (!!payload.locationId && managedIds.has(payload.locationId)),
      ),
      map((payload) => ({ data: payload }) as MessageEvent),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List shifts with optional filters (paginated)' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ShiftStatus })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  findAll(
    @CurrentUser() user: User,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: ShiftStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
  ) {
    return this.svc.findAll({
      locationId,
      startDate,
      endDate,
      status,
      requestingUser: user,
      page,
      limit,
    });
  }

  @Get('available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Shifts available for staff to pick up' })
  availableForPickup(@CurrentUser() user: User) {
    return this.svc.availableForPickup(user);
  }

  @Get('on-duty-now')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Who is currently on shift' })
  onDutyNow(@CurrentUser() user: User) {
    return this.svc.onDutyNow(user);
  }

  @Get('cross-location-available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Staff certified at a location, available on a date, and not already assigned anywhere that day',
  })
  @ApiQuery({
    name: 'locationId',
    required: true,
    description: 'Target location UUID',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    description: 'Date to check availability (YYYY-MM-DD)',
  })
  crossLocationAvailable(
    @Query('locationId') locationId: string,
    @Query('date') date: string,
  ) {
    return this.svc.getCrossLocationAvailable(locationId, date);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get shift by ID' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a shift' })
  create(@Body() dto: CreateShiftDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Post('auto-schedule')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Auto-generate a draft schedule for a full week at a location (heuristic)',
  })
  autoSchedule(@Body() dto: AutoScheduleDto, @CurrentUser() user: User) {
    return this.svc.autoSchedule(dto, user);
  }

  @Post('publish-week')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Publish all draft shifts for a week at a location',
  })
  publishWeek(@Body() dto: PublishWeekDto, @CurrentUser() user: User) {
    return this.svc.publishWeek(dto, user);
  }

  @Post('copy-week')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Copy all shifts from one week to another (as drafts)',
  })
  copyWeek(
    @Body()
    body: {
      sourceWeekStart: string;
      targetWeekStart: string;
      locationId: string;
    },
    @CurrentUser() user: User,
  ) {
    return this.svc.copyWeek(
      body.sourceWeekStart,
      body.targetWeekStart,
      body.locationId,
      user,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a shift' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Publish a single shift' })
  publish(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.publish(id, user);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Unpublish a shift (before 48h cutoff)' })
  unpublish(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.unpublish(id, user);
  }

  @Post(':id/validate-assignment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Validate assigning staff to a shift (dry run — no DB write)',
  })
  validateAssignment(
    @Param('id') id: string,
    @Body() dto: AssignStaffDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.validateAssignment(id, dto, user);
  }

  @Post(':id/assignments')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Assign a staff member to a shift' })
  assignStaff(
    @Param('id') id: string,
    @Body() dto: AssignStaffDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.assignStaff(id, dto, user);
  }

  @Patch(':shiftId/assignments/:assignmentId/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF)
  @ApiOperation({
    summary: 'Staff confirms acknowledgement of their shift assignment',
  })
  confirmAssignment(
    @Param('shiftId') shiftId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.confirmAssignment(shiftId, assignmentId, user);
  }

  @Delete(':shiftId/assignments/:assignmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Remove a staff assignment from a shift' })
  removeAssignment(
    @Param('shiftId') shiftId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.removeAssignment(shiftId, assignmentId, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a shift' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.remove(id, user);
  }
}
