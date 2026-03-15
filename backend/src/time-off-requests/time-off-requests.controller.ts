import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TimeOffRequestsService } from './time-off-requests.service';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { ReviewTimeOffDto } from './dto/review-time-off.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('time-off-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-off-requests')
export class TimeOffRequestsController {
  constructor(private svc: TimeOffRequestsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List time-off requests (paginated; staff sees own, managers see all)',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  list(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.svc.list(user, limit, offset);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Submit a time-off request' })
  create(@Body() dto: CreateTimeOffRequestDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve a time-off request (manager/admin)' })
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewTimeOffDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.approve(id, user, dto.managerNote);
  }

  @Patch(':id/deny')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Deny a time-off request (manager/admin)' })
  deny(
    @Param('id') id: string,
    @Body() dto: ReviewTimeOffDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.deny(id, user, dto.managerNote);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a pending time-off request (staff only)' })
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.cancel(id, user);
  }
}
