import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Skill } from '../skills/entities/skill.entity';
import { Location } from '../locations/entities/location.entity';
import { Availability } from './entities/availability.entity';
import { AvailabilityException } from './entities/availability-exception.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Skill, Location, Availability, AvailabilityException])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
