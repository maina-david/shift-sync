import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Timesheet } from './entities/timesheet.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { TimesheetsService } from './timesheets.service';
import { TimesheetsController } from './timesheets.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Timesheet, ShiftAssignment]),
    SettingsModule,
  ],
  providers: [TimesheetsService],
  controllers: [TimesheetsController],
  exports: [TimesheetsService],
})
export class TimesheetsModule {}
