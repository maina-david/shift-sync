import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('skills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('skills')
export class SkillsController {
  constructor(private svc: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'List all skills' })
  findAll() {
    return this.svc.findAll();
  }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a skill (admin)' })
  create(@Body() dto: CreateSkillDto) {
    return this.svc.create(dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a skill (admin)' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
