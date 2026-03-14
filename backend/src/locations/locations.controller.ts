import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
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
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get location by ID' })
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  @HttpCode(201)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a location (admin)' })
  create(@Body() dto: CreateLocationDto) { return this.svc.create(dto); }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a location (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) { return this.svc.update(id, dto); }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a location (admin)' })
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
