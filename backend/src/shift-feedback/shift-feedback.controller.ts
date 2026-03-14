import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ShiftFeedbackService } from './shift-feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('shift-feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shift-feedback')
export class ShiftFeedbackController {
  constructor(private readonly svc: ShiftFeedbackService) {}

  // ─── Staff endpoints ──────────────────────────────────────────────────────

  @Post()
  @HttpCode(201)
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Submit post-shift feedback for a completed assignment' })
  submit(@Body() dto: CreateFeedbackDto, @CurrentUser() user: User) {
    return this.svc.submit(user.id, dto);
  }

  @Get('mine')
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: "List the current staff member's own feedback submissions" })
  getMyFeedback(@CurrentUser() user: User) {
    return this.svc.getMyFeedback(user.id);
  }

  // ─── Manager / Admin endpoints ────────────────────────────────────────────

  @Get('shift/:shiftId')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all feedback for a specific shift (manager/admin)' })
  getForShift(@Param('shiftId') shiftId: string) {
    return this.svc.getForShift(shiftId);
  }

  @Get('summary')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Aggregate feedback summary with optional location and date range filters (manager/admin)' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location UUID' })
  @ApiQuery({ name: 'startDate',  required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate',    required: false, description: 'End date (YYYY-MM-DD)' })
  getSummary(
    @CurrentUser() user: User,
    @Query('locationId') locationId?: string,
    @Query('startDate')  startDate?: string,
    @Query('endDate')    endDate?: string,
  ) {
    const managedLocationIds = user.role === UserRole.MANAGER
      ? (user.managedLocations?.map((l) => l.id) ?? [])
      : undefined;
    return this.svc.getSummary(locationId, startDate, endDate, managedLocationIds);
  }
}
