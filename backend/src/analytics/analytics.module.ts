import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Shift } from '../shifts/entities/shift.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { User } from '../users/entities/user.entity';
import { TimeOffRequest } from '../time-off-requests/entities/time-off-request.entity';
import { SwapRequest } from '../swap-requests/entities/swap-request.entity';
import { DropRequest } from '../drop-requests/entities/drop-request.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { SseJwtGuard } from '../common/guards/sse-jwt.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shift,
      ShiftAssignment,
      User,
      TimeOffRequest,
      SwapRequest,
      DropRequest,
      Reservation,
    ]),
    AuthModule,
  ],
  providers: [AnalyticsService, SseJwtGuard],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
