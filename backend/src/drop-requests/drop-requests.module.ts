import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DropRequestsService } from './drop-requests.service';
import { DropRequestsController } from './drop-requests.controller';
import { DropRequest } from './entities/drop-request.entity';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { User } from '../users/entities/user.entity';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DropRequest, ShiftAssignment, User]),
    ShiftsModule,
  ],
  providers: [DropRequestsService],
  controllers: [DropRequestsController],
})
export class DropRequestsModule {}
