import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogBookService } from './log-book.service';
import { LogBookController } from './log-book.controller';
import { LogEntry } from './entities/log-entry.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LogEntry, User])],
  providers: [LogBookService],
  controllers: [LogBookController],
})
export class LogBookModule {}
