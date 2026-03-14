import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { ConstraintCheckerService } from './constraint-checker.service';
import { Shift } from './entities/shift.entity';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { User } from '../users/entities/user.entity';
import { Availability } from '../users/entities/availability.entity';
import { AvailabilityException } from '../users/entities/availability-exception.entity';
import { SwapRequest } from '../swap-requests/entities/swap-request.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { SseJwtGuard } from '../common/guards/sse-jwt.guard';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shift,
      ShiftAssignment,
      User,
      Availability,
      AvailabilityException,
      SwapRequest,
    ]),
    UsersModule,
    AuthModule,
    SettingsModule,
  ],
  providers: [ShiftsService, ConstraintCheckerService, SseJwtGuard],
  controllers: [ShiftsController],
  exports: [ShiftsService, ConstraintCheckerService],
})
export class ShiftsModule {}
