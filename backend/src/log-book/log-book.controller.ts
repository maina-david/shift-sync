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
import { LogBookService } from './log-book.service';
import { CreateLogEntryDto } from './dto/create-log-entry.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('log-book')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('log-book')
export class LogBookController {
  constructor(private svc: LogBookService) {}

  @Get()
  @ApiOperation({
    summary: 'List log entries for a date (optionally filter by location)',
  })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'locationId', required: false })
  list(
    @Query('date') date: string,
    @Query('locationId') locationId: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.svc.list(date, locationId, user);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a log entry' })
  create(@Body() dto: CreateLogEntryDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a log entry' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.remove(id, user);
  }
}
