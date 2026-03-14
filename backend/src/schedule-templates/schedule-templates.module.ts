import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleTemplatesService } from './schedule-templates.service';
import { ScheduleTemplatesController } from './schedule-templates.controller';
import { ScheduleTemplate } from './entities/schedule-template.entity';
import { Shift } from '../shifts/entities/shift.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleTemplate, Shift])],
  providers: [ScheduleTemplatesService],
  controllers: [ScheduleTemplatesController],
  exports: [ScheduleTemplatesService],
})
export class ScheduleTemplatesModule {}
