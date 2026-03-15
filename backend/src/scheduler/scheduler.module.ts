import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SchedulerService } from './scheduler.service';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { TimeOffRequest } from '../time-off-requests/entities/time-off-request.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { SwapRequest } from '../swap-requests/entities/swap-request.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Certification } from '../certifications/entities/certification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShiftAssignment,
      Shift,
      TimeOffRequest,
      Reservation,
      SwapRequest,
      User,
      Notification,
      Certification,
    ]),
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
