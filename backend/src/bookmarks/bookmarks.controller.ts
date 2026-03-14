import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookmarksService } from './bookmarks.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('bookmarks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookmarks')
export class BookmarksController {
  constructor(private svc: BookmarksService) {}

  @Get()
  @ApiOperation({ summary: 'Get my bookmarks' })
  findAll(@CurrentUser() user: User) {
    return this.svc.findAll(user.id);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a bookmark' })
  create(@Body() dto: CreateBookmarkDto, @CurrentUser() user: User) {
    return this.svc.create(dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bookmark' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.svc.remove(id, user.id);
  }
}
