import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {
    this.from = this.config.get<string>(
      'SMTP_FROM',
      'ShiftSync <noreply@shiftsync.dev>',
    );
    this.enabled = !!this.config.get<string>('SMTP_USER', '');
  }

  async send(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `[EMAIL SKIPPED — no SMTP_USER] To: ${to} | ${subject}`,
      );
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const info = await this.mailer.sendMail({
        from: this.from,
        to,
        subject,
        text: text ?? subject,
        html,
      });
      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Email sent → ${to} (messageId: ${info?.messageId ?? 'n/a'})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}: ${(err as Error).message}`,
      );
    }
  }

  /** Renders the ShiftSync notification HTML template and sends it */
  sendNotification(to: string, subject: string, body: string): Promise<void> {
    return this.send(to, subject, buildNotificationHtml(subject, body));
  }
}

// ─── HTML template ────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNotificationHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${escHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:20px 32px;border-bottom:1px solid #334155;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:#3b82f6;border-radius:8px;width:32px;height:32px;
                         text-align:center;vertical-align:middle;">
                <span style="color:#fff;font-size:16px;font-weight:700;line-height:32px;">&#9889;</span>
              </td>
              <td style="padding-left:10px;vertical-align:middle;">
                <span style="color:#f8fafc;font-size:16px;font-weight:700;letter-spacing:-0.3px;">ShiftSync</span>
                <span style="color:#64748b;font-size:12px;margin-left:6px;">· Coastal Eats</span>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;color:#f8fafc;font-size:20px;font-weight:700;line-height:1.3;">
              ${escHtml(title)}
            </h2>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
              ${escHtml(message)}
            </p>
            <hr style="border:none;border-top:1px solid #334155;margin:24px 0;"/>
            <p style="margin:0;color:#475569;font-size:12px;line-height:1.6;">
              You received this email because your ShiftSync account has email notifications
              enabled. To manage preferences, sign in and visit
              <strong style="color:#64748b;">Settings → Notifications</strong>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;padding:16px 32px;border-top:1px solid #334155;">
            <p style="margin:0;color:#475569;font-size:11px;text-align:center;">
              &copy; ${new Date().getFullYear()} ShiftSync &middot; Coastal Eats
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
