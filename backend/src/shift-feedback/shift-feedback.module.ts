import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftFeedback } from './entities/shift-feedback.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { ShiftFeedbackService } from './shift-feedback.service';
import { ShiftFeedbackController } from './shift-feedback.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShiftFeedback, ShiftAssignment])],
  providers: [ShiftFeedbackService],
  controllers: [ShiftFeedbackController],
  exports: [ShiftFeedbackService],
})
export class ShiftFeedbackModule {}
