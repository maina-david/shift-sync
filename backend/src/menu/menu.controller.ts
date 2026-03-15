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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private svc: MenuService) {}

  /** Public — no auth required */
  @Get()
  findAll(@Query('locationId') locationId?: string) {
    return this.svc.findAll(locationId);
  }

  @Get('highlights')
  findHighlights(@Query('locationId') locationId?: string) {
    return this.svc.findHighlights(locationId);
  }

  /** Protected — manager / admin only */
  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  findAllAdmin(@Query('locationId') locationId?: string) {
    return this.svc.findAllAdmin(locationId);
  }

  @Post()
  @HttpCode(201)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  create(@Body() dto: CreateMenuItemDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateMenuItemDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/toggle-highlight')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  toggleHighlight(@Param('id') id: string) {
    return this.svc.toggleHighlight(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
