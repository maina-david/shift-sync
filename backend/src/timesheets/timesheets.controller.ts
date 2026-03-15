import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { TimesheetsService, TimesheetQuery, PayrollExportQuery } from './timesheets.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { ReviewTimesheetDto } from './dto/review-timesheet.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { TimesheetStatus } from './entities/timesheet.entity';

@ApiTags('timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly svc: TimesheetsService) {}

  @Post('clock-in')
  @HttpCode(201)
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Clock in to start a time-tracking session' })
  clockIn(@Body() dto: ClockInDto, @CurrentUser() user: User) {
    return this.svc.clockIn(user.id, dto);
  }

  @Post('clock-out')
  @HttpCode(200)
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Clock out and close the current session' })
  clockOut(@Body() dto: ClockOutDto, @CurrentUser() user: User) {
    return this.svc.clockOut(user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: "List the current staff member's own timesheets" })
  findMine(@CurrentUser() user: User) {
    return this.svc.findMine(user.id);
  }

  @Get('open')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Get the currently open (clocked-in) timesheet, or null' })
  getOpen(@CurrentUser() user: User) {
    return this.svc.getOpenTimesheet(user.id);
  }

  @Get('export')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Download approved timesheets as a payroll CSV (manager/admin)' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location UUID' })
  @ApiQuery({ name: 'startDate',  required: true,  description: 'Start of pay period (ISO date, e.g. 2025-01-01)' })
  @ApiQuery({ name: 'endDate',    required: true,  description: 'End of pay period (ISO date, e.g. 2025-01-31)' })
  @ApiQuery({ name: 'status',     required: false, enum: TimesheetStatus, description: 'Timesheet status to export (default: approved)' })
  async exportCsv(
    @Query('startDate')  startDate: string,
    @Query('endDate')    endDate: string,
    @Res() res: Response,
    @CurrentUser() user: User,
    @Query('locationId') locationId?: string,
    @Query('status')     status?: TimesheetStatus,
  ) {
    const query: PayrollExportQuery = { locationId, startDate, endDate, status };

    if (user.role === UserRole.MANAGER) {
      const managedIds = user.managedLocations?.map((l) => l.id) ?? [];
      if (locationId) {
        if (!managedIds.includes(locationId)) {
          throw new ForbiddenException('You do not manage this location');
        }
      } else {
        query.allowedLocationIds = managedIds;
      }
    }

    const csv = await this.svc.export(query);

    res
      .set('Content-Type', 'text/csv')
      .set('Content-Disposition', `attachment; filename="payroll-${startDate}-${endDate}.csv"`)
      .send(csv);
  }

  @Get()
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List all timesheets with optional filters (manager/admin)' })
  @ApiQuery({ name: 'staffId',    required: false, description: 'Filter by staff UUID' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location UUID' })
  @ApiQuery({ name: 'status',     required: false, enum: TimesheetStatus, description: 'Filter by approval status' })
  @ApiQuery({ name: 'startDate',  required: false, description: 'ISO date string — only timesheets with clockIn on or after this date' })
  @ApiQuery({ name: 'endDate',    required: false, description: 'ISO date string — only timesheets with clockIn on or before this date' })
  findAll(
    @CurrentUser() user: User,
    @Query('staffId')    staffId?: string,
    @Query('locationId') locationId?: string,
    @Query('status')     status?: TimesheetStatus,
    @Query('startDate')  startDate?: string,
    @Query('endDate')    endDate?: string,
  ) {
    const query: TimesheetQuery = { staffId, locationId, status, startDate, endDate };

    if (user.role === UserRole.MANAGER) {
      const managedIds = user.managedLocations?.map((l) => l.id) ?? [];
      if (locationId) {
        if (!managedIds.includes(locationId)) {
          throw new ForbiddenException('You do not manage this location');
        }
      } else {
        query.allowedLocationIds = managedIds;
      }
    }

    return this.svc.findAll(query);
  }

  @Patch(':id/review')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject a pending timesheet (manager/admin)' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewTimesheetDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.review(id, dto, user);
  }
}
