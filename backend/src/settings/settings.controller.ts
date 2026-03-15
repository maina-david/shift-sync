import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all system settings with current values (admin only)',
  })
  findAll() {
    return this.settingsService.findAll();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a system setting by key (admin only)' })
  update(
    @Param('key') key: string,
    @Body()
    body: { value?: unknown; description?: string; isEnabled?: boolean },
  ) {
    return this.settingsService.set(key, body);
  }

  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reset all settings to their default values (admin only)',
  })
  async resetToDefaults(): Promise<void> {
    await this.settingsService.resetToDefaults();
  }
}
