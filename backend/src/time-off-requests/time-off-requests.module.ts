import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequestsService } from './time-off-requests.service';
import { TimeOffRequestsController } from './time-off-requests.controller';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TimeOffRequest, User])],
  providers: [TimeOffRequestsService],
  controllers: [TimeOffRequestsController],
})
export class TimeOffRequestsModule {}
