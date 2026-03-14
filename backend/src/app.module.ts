import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LocationsModule } from './locations/locations.module';
import { SkillsModule } from './skills/skills.module';
import { ShiftsModule } from './shifts/shifts.module';
import { SwapRequestsModule } from './swap-requests/swap-requests.module';
import { DropRequestsModule } from './drop-requests/drop-requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { TimeOffRequestsModule } from './time-off-requests/time-off-requests.module';
import { LogBookModule } from './log-book/log-book.module';
import { MenuModule } from './menu/menu.module';
import { ReservationsModule } from './reservations/reservations.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EmailModule } from './email/email.module';
import { ScheduleTemplatesModule } from './schedule-templates/schedule-templates.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { CertificationsModule } from './certifications/certifications.module';
import { MessagesModule } from './messages/messages.module';
import { SettingsModule } from './settings/settings.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { ShiftFeedbackModule } from './shift-feedback/shift-feedback.module';
import { FairWorkweekModule } from './fair-workweek/fair-workweek.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('app.nodeEnv') !== 'production',
        logging: false,
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1_000,  limit: 10  },   // 10 req / second
      { name: 'medium', ttl: 10_000, limit: 50  },   // 50 req / 10 s
      { name: 'long',   ttl: 60_000, limit: 200 },   // 200 req / minute
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    SettingsModule,
    EmailModule,
    AuthModule,
    UsersModule,
    LocationsModule,
    SkillsModule,
    ShiftsModule,
    SwapRequestsModule,
    DropRequestsModule,
    NotificationsModule,
    AnalyticsModule,
    AuditModule,
    TimeOffRequestsModule,
    LogBookModule,
    MenuModule,
    ReservationsModule,
    BookmarksModule,
    SchedulerModule,
    ScheduleTemplatesModule,
    TimesheetsModule,
    CertificationsModule,
    MessagesModule,
    ChecklistsModule,
    ShiftFeedbackModule,
    FairWorkweekModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
