import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Post,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetAvailabilityDto, AvailabilityExceptionDto } from './dto/set-availability.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (admin/manager)' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiQuery({ name: 'locationId', required: false })
  findAll(@CurrentUser() user: User, @Query('locationId') locationId?: string) {
    return this.usersService.findAll(user, locationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string, @CurrentUser() requester: User) {
    return this.usersService.findOne(id, requester);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile / skills / locations' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: User) {
    return this.usersService.update(id, dto, user);
  }

  @Patch(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset a user password (admin only)' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.resetPassword(id, dto.newPassword, user);
  }

  @Patch(':id/change-password')
  @ApiOperation({ summary: 'Change user password' })
  changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.changePassword(id, dto.currentPassword, dto.newPassword, user);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Get staff availability (recurring + exceptions)' })
  getAvailability(@Param('id') id: string) {
    return this.usersService.getAvailability(id);
  }

  @Put(':id/availability')
  @ApiOperation({ summary: 'Replace staff recurring weekly availability' })
  setAvailability(
    @Param('id') id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.setAvailability(id, dto, user.id);
  }

  @Post(':id/availability-exceptions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a one-off availability exception' })
  addException(
    @Param('id') id: string,
    @Body() dto: AvailabilityExceptionDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.addAvailabilityException(id, dto, user.id);
  }

  @Delete(':id/availability-exceptions/:exId')
  @ApiOperation({ summary: 'Remove an availability exception' })
  removeException(@Param('exId') exId: string, @CurrentUser() user: User) {
    return this.usersService.removeAvailabilityException(exId, user.id);
  }
}
