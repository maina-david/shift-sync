import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { FloorZoneConfig } from './entities/location.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private svc: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all locations (public)' })
  findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get location by ID' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a location (admin)' })
  create(@Body() dto: CreateLocationDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a location (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a location (admin)' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Put(':id/zones')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Replace the floor plan zone config for a location (admin)',
  })
  updateZones(
    @Param('id') id: string,
    @Body() body: { zones: FloorZoneConfig[] },
  ) {
    return this.svc.updateZones(id, body.zones);
  }

  @Delete(':id/zones')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset floor plan zones to defaults (admin)' })
  resetZones(@Param('id') id: string) {
    return this.svc.resetZones(id);
  }
}
