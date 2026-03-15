import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ScheduleTemplatesService } from './schedule-templates.service';
import { CreateScheduleTemplateDto } from './dto/create-schedule-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('schedule-templates')
@ApiBearerAuth()
@Controller('schedule-templates')
export class ScheduleTemplatesController {
  constructor(private readonly svc: ScheduleTemplatesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'List schedule templates, optionally filtered by location',
  })
  @ApiQuery({ name: 'locationId', required: false })
  findAll(@Query('locationId') locationId?: string) {
    return this.svc.findAll(locationId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get a schedule template by ID' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new schedule template' })
  create(@Body() dto: CreateScheduleTemplateDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a schedule template' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @Post(':id/apply')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Apply a template to a week, creating DRAFT shifts',
  })
  apply(
    @Param('id') id: string,
    @Body() body: { weekStart: string },
    @CurrentUser() user: User,
  ) {
    return this.svc.apply(id, body.weekStart, user.id);
  }
}
