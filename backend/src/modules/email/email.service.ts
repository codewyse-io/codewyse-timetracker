import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { credentialsTemplate } from './templates/credentials.template';
import { newVersionTemplate } from './templates/new-version.template';
import { leaveRequestAdminTemplate } from './templates/leave-request-admin.template';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY is not set — email sending is disabled');
    }
    this.from = this.configService.get<string>('EMAIL_FROM', 'PulseTrack <onboarding@resend.dev>');
  }

  async sendCredentialsEmail(
    email: string,
    firstName: string,
    password: string,
  ): Promise<void> {
    const html = credentialsTemplate(firstName, email, password);

    await this.sendEmail(
      email,
      'Your PulseTrack Account Credentials',
      html,
    );
  }

  async sendNewVersionEmail(
    email: string,
    version: string,
    windowsUrl: string | null,
    macUrl: string | null,
  ): Promise<void> {
    const html = newVersionTemplate(version, windowsUrl, macUrl);
    await this.sendEmail(email, `Pulse v${version} — Update Available`, html);
  }

  async sendLeaveRequestNotification(
    adminEmail: string,
    employeeName: string,
    subject: string,
    startDate: string,
    endDate: string,
    totalDays: number,
    message: string,
    adminPanelUrl: string,
  ): Promise<void> {
    const html = leaveRequestAdminTemplate(
      employeeName, subject, startDate, endDate, totalDays, message, adminPanelUrl,
    );
    await this.sendEmail(adminEmail, `Leave Request: ${subject} — ${employeeName}`, html);
  }

  async sendWeeklyReportEmail(
    email: string,
    reportData: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(`Weekly report email to ${email} - not yet implemented`);
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    this.logger.log(`Password reset email to ${email} - not yet implemented`);
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`Email to ${to} skipped — RESEND_API_KEY not configured`);
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  }
}
