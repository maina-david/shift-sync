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
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private svc: ReservationsService) {}

  /** Public — customers book without logging in */
  @Post()
  @HttpCode(201)
  @Throttle({
    short: { ttl: 60_000, limit: 5 },
    medium: { ttl: 60_000, limit: 5 },
    long: { ttl: 60_000, limit: 10 },
  })
  create(@Body() dto: CreateReservationDto) {
    return this.svc.create(dto);
  }

  /** Protected — staff portal */
  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Query('date') date?: string,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.findAll({ date, locationId, status });
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateReservationDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
