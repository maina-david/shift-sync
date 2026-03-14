import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapRequestsService } from './swap-requests.service';
import { SwapRequestsController } from './swap-requests.controller';
import { SwapRequest } from './entities/swap-request.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { User } from '../users/entities/user.entity';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapRequest, ShiftAssignment, User]),
    ShiftsModule,
  ],
  providers: [SwapRequestsService],
  controllers: [SwapRequestsController],
})
export class SwapRequestsModule {}
