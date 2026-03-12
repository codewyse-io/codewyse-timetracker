import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { invitationTemplate } from './templates/invitation.template';

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

  async sendInvitationEmail(
    email: string,
    firstName: string,
    inviteToken: string,
  ): Promise<void> {
    const adminUrl = this.configService.get<string>('app.adminUrl');
    const inviteUrl = `${adminUrl}/accept-invite?token=${inviteToken}`;
    const html = invitationTemplate(firstName, inviteUrl);

    await this.sendEmail(
      email,
      'You have been invited to PulseTrack',
      html,
    );
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
