import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let mailer: jest.Mocked<any>;
  let config: jest.Mocked<any>;

  const buildService = async (smtpUser: string) => {
    config = {
      get: jest.fn().mockImplementation((key: string, fallback?: string) => {
        if (key === 'SMTP_USER') return smtpUser;
        return fallback ?? '';
      }),
    };
    mailer = { sendMail: jest.fn().mockResolvedValue({ messageId: 'abc123' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: MailerService, useValue: mailer },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    return module.get<EmailService>(EmailService);
  };

  describe('send — SMTP disabled', () => {
    beforeEach(async () => {
      service = await buildService('');
    });

    it('skips sending when SMTP_USER is not configured', async () => {
      await service.send('to@example.com', 'Subject', '<p>Hello</p>');
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('send — SMTP enabled', () => {
    beforeEach(async () => {
      service = await buildService('user@smtp.example.com');
    });

    it('calls mailer.sendMail with correct fields', async () => {
      await service.send('to@example.com', 'Hello', '<p>World</p>');
      expect(mailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          subject: 'Hello',
          html: '<p>World</p>',
        }),
      );
    });

    it('swallows mailer errors without throwing', async () => {
      mailer.sendMail.mockRejectedValue(new Error('SMTP failure'));
      await expect(service.send('to@example.com', 'Subject', '<p>Hello</p>')).resolves.not.toThrow();
    });
  });

  describe('sendNotification', () => {
    beforeEach(async () => {
      service = await buildService('user@smtp.example.com');
    });

    it('wraps body in HTML template and sends', async () => {
      await service.sendNotification('to@example.com', 'Shift Alert', 'You have a shift.');
      expect(mailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          subject: 'Shift Alert',
          html: expect.stringContaining('Shift Alert'),
        }),
      );
    });

    it('HTML-escapes special characters in subject and body', async () => {
      await service.sendNotification('to@example.com', '<script>Alert</script>', '<XSS>');
      const call = mailer.sendMail.mock.calls[0][0];
      expect(call.html).not.toContain('<script>');
      expect(call.html).toContain('&lt;script&gt;');
    });
  });
});
