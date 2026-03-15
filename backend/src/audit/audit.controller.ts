import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private svc: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Query audit logs with filters (paginated)' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: User,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    let scopedLocationId = locationId;

    if (user.role === UserRole.MANAGER) {
      const managedIds = user.managedLocations?.map((l) => l.id) ?? [];
      if (locationId) {
        if (!managedIds.includes(locationId)) {
          throw new ForbiddenException(
            'You do not manage the requested location',
          );
        }
      } else {
        // No locationId provided — restrict to manager's own locations via filter
        // Pass the first managed location or a sentinel when they manage no locations
        scopedLocationId = managedIds.length > 0 ? undefined : '__none__';
      }
    }

    return this.svc.findAll({
      entity,
      entityId,
      locationId: scopedLocationId,
      startDate,
      endDate,
      page,
      limit,
      managedLocationIds:
        user.role === UserRole.MANAGER
          ? (user.managedLocations?.map((l) => l.id) ?? [])
          : undefined,
    });
  }

  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Export audit logs as CSV (admin only)' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportCsv(
    @Res() res: Response,
    @Query('entity') entity?: string,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.svc.exportCsv({
      entity,
      locationId,
      startDate,
      endDate,
    });
    const filename = `audit-${startDate ?? 'all'}-to-${endDate ?? 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('shift/:shiftId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get full audit history for a specific shift' })
  forShift(@Param('shiftId') shiftId: string) {
    return this.svc.findForShift(shiftId);
  }
}
