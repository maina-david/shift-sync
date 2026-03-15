import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        transport: {
          host: cfg.get<string>('SMTP_HOST', 'sandbox.smtp.mailtrap.io'),
          port: cfg.get<number>('SMTP_PORT', 587),
          secure: false, // STARTTLS on port 587
          auth: {
            user: cfg.get<string>('SMTP_USER', ''),
            pass: cfg.get<string>('SMTP_PASS', ''),
          },
        },
        defaults: {
          from: cfg.get<string>(
            'SMTP_FROM',
            'ShiftSync <noreply@shiftsync.dev>',
          ),
        },
      }),
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
