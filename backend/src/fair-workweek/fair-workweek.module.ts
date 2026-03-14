import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleChangeLog } from './entities/schedule-change-log.entity';
import { FairWorkweekService } from './fair-workweek.service';
import { FairWorkweekController } from './fair-workweek.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleChangeLog])],
  providers: [FairWorkweekService],
  controllers: [FairWorkweekController],
  exports: [FairWorkweekService],
})
export class FairWorkweekModule {}
