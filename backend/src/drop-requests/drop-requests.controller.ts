import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DropRequestsService } from './drop-requests.service';
import { CreateDropRequestDto } from './dto/create-drop-request.dto';
import { ReviewDropDto } from './dto/review-drop.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('drop-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('drop-requests')
export class DropRequestsController {
  constructor(private svc: DropRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List drop requests (role-filtered)' })
  findAll(@CurrentUser() user: User) { return this.svc.findAll(user); }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Drop a shift assignment' })
  create(@Body() dto: CreateDropRequestDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Patch(':id/claim')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Claim an open drop request' })
  claim(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.claim(id, user);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve a claimed drop request (manager)' })
  approve(@Param('id') id: string, @Body() dto: ReviewDropDto, @CurrentUser() user: User) {
    return this.svc.approve(id, user, dto);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Reject a drop request (manager)' })
  reject(@Param('id') id: string, @Body() dto: ReviewDropDto, @CurrentUser() user: User) {
    return this.svc.reject(id, user, dto);
  }

  @Delete(':id')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Cancel an open drop request' })
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.cancel(id, user);
  }
}
