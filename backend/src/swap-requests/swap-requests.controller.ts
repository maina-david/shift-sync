import { Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SwapRequestsService } from './swap-requests.service';
import { CreateSwapRequestDto } from './dto/create-swap-request.dto';
import { ReviewSwapDto } from './dto/review-swap.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('swap-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('swap-requests')
export class SwapRequestsController {
  constructor(private svc: SwapRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List swap requests relevant to the current user (paginated)' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  findAll(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) { return this.svc.findAll(user, limit, offset); }

  @Post()
  @HttpCode(201)
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Request a shift swap' })
  create(@Body() dto: CreateSwapRequestDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Patch(':id/accept')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Accept a swap request (target staff)' })
  accept(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.accept(id, user);
  }

  @Patch(':id/reject')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Reject a swap request (target staff)' })
  reject(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.reject(id, user);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve a swap request (manager)' })
  approve(@Param('id') id: string, @Body() dto: ReviewSwapDto, @CurrentUser() user: User) {
    return this.svc.approve(id, user, dto);
  }

  @Patch(':id/deny')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Deny a swap request (manager)' })
  deny(@Param('id') id: string, @Body() dto: ReviewSwapDto, @CurrentUser() user: User) {
    return this.svc.deny(id, user, dto);
  }

  @Delete(':id')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Cancel a swap request (requester only)' })
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.cancel(id, user);
  }
}
