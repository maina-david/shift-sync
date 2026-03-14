import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CertificationsService } from './certifications.service';
import { CreateCertificationDto } from './dto/create-certification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('certifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('certifications')
export class CertificationsController {
  constructor(private svc: CertificationsService) {}

  @Get('mine')
  @ApiOperation({ summary: "Get my certifications" })
  findMine(@CurrentUser() user: User) {
    return this.svc.findForUser(user.id);
  }

  @Get('expiring')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List certifications expiring soon (admin/manager)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  findExpiring(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.svc.findExpiringSoon(days);
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: "Get certifications for a specific user (admin/manager)" })
  findForUser(@Param('userId') userId: string, @CurrentUser() user: User) {
    const managedLocationIds = user.role === UserRole.MANAGER
      ? (user.managedLocations?.map((l) => l.id) ?? [])
      : undefined;
    return this.svc.findForUser(userId, managedLocationIds);
  }

  @Post('user/:userId')
  @HttpCode(201)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Add a certification for a user (admin/manager)' })
  create(
    @Param('userId') userId: string,
    @Body() dto: CreateCertificationDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.create(userId, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a certification (owner, manager, or admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.remove(id, user.id, user.role, user.managedLocations?.map((l) => l.id));
  }
}
