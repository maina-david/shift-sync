import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FairWorkweekService } from './fair-workweek.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('fair-workweek')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fair-workweek')
export class FairWorkweekController {
  constructor(private readonly svc: FairWorkweekService) {}

  @Get('violations')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'List schedule changes that triggered predictability pay obligations (admin/manager)',
  })
  @ApiQuery({
    name: 'locationId',
    required: false,
    description: 'Filter by location UUID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter from this shift date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter up to this shift date (YYYY-MM-DD)',
  })
  getViolations(
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.getViolations(locationId, startDate, endDate);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Aggregate count of violations and total estimated predictability pay owed (admin/manager)',
  })
  @ApiQuery({
    name: 'locationId',
    required: false,
    description: 'Filter by location UUID',
  })
  getSummary(@Query('locationId') locationId?: string) {
    return this.svc.getSummary(locationId);
  }
}
