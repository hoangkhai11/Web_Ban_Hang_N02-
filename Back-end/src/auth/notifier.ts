import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type Channel = 'email' | 'sms';

/**
 * Gửi mã xác nhận tới khách hàng.
 * - Email: qua SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM).
 * - SMS: qua Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).
 * Kênh chưa cấu hình thì chỉ ghi mã ra log server (chế độ demo).
 */
@Injectable()
export class Notifier {
  private readonly logger = new Logger('Notifier');
  private mailer?: Transporter;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    if (host) {
      const port = Number(config.get('SMTP_PORT', 587));
      this.mailer = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') },
      });
    }
  }

  isConfigured(channel: Channel) {
    if (channel === 'email') return !!this.mailer;
    return !!(this.config.get('TWILIO_ACCOUNT_SID') && this.config.get('TWILIO_AUTH_TOKEN') && this.config.get('TWILIO_FROM'));
  }

  async send(channel: Channel, to: string, subject: string, text: string) {
    if (!this.isConfigured(channel)) {
      if (process.env.NODE_ENV === 'production') throw new Error(`Chưa cấu hình kênh gửi ${channel}`);
      this.logger.warn(`[DEMO - chưa cấu hình ${channel}] Gửi tới ${to}: ${text}`);
      return;
    }
    if (channel === 'email') {
      await this.mailer!.sendMail({ from: this.config.get('MAIL_FROM', this.config.get('SMTP_USER')), to, subject, text });
      return;
    }
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${this.config.get('TWILIO_AUTH_TOKEN')}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Số Việt Nam 0xxxxxxxxx → +84xxxxxxxxx
      body: new URLSearchParams({ To: to.replace(/^0/, '+84'), From: this.config.get<string>('TWILIO_FROM')!, Body: text }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  }
}
