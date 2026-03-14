import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { ChecklistsService } from './checklists.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('checklists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('checklists')
export class ChecklistsController {
  constructor(private readonly svc: ChecklistsService) {}

  // ─── Admin / Manager ──────────────────────────────────────────────────────

  @Post()
  @HttpCode(201)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new opening, closing, or custom checklist (admin/manager)' })
  create(@Body() dto: CreateChecklistDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Delete a checklist by ID (admin/manager)' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.svc.remove(id);
  }

  // ─── All Authenticated Users ──────────────────────────────────────────────

  @Get()
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List checklists with optional location and date filters' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location UUID' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by shift date (YYYY-MM-DD)' })
  findAll(
    @Query('locationId') locationId?: string,
    @Query('date') date?: string,
  ) {
    return this.svc.findAll(locationId, date);
  }

  @Get(':id')
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a single checklist by ID' })
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id/items/:itemId/complete')
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark a checklist item as completed by the current user' })
  completeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.completeItem(id, itemId, user.id);
  }
}
