import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import { google, calendar_v3 } from 'googleapis';
import { GoogleCalendarConnection } from './entities/google-calendar-connection.entity';
import { Meeting, MeetingPlatform, MeetingStatus } from '../meetings/entities/meeting.entity';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    @InjectRepository(GoogleCalendarConnection)
    private readonly connectionRepo: Repository<GoogleCalendarConnection>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET', '');
    this.redirectUri = this.configService.get<string>(
      'GOOGLE_REDIRECT_URI',
      'http://localhost:3000/google-calendar/callback',
    );
  }

  private createOAuth2Client() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
  }

  async getAuthUrl(userId: string, orgId: string): Promise<string> {
    const oauth2Client = this.createOAuth2Client();
    const state = this.jwtService.sign({ userId, orgId }, { expiresIn: '10m' });

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });

    return url;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    this.logger.log(`[Callback] Processing OAuth callback`);

    let payload: { userId: string; orgId: string };
    try {
      payload = this.jwtService.verify(state);
      this.logger.log(`[Callback] State decoded: userId=${payload.userId}`);
    } catch (err: any) {
      this.logger.error(`[Callback] Invalid state token: ${err.message}`);
      throw new UnauthorizedException('Invalid or expired state token');
    }

    const oauth2Client = this.createOAuth2Client();

    let tokens: any;
    try {
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
      this.logger.log(`[Callback] Got tokens, access_token: ${tokens.access_token ? 'yes' : 'no'}, refresh_token: ${tokens.refresh_token ? 'yes' : 'no'}`);
    } catch (err: any) {
      this.logger.error(`[Callback] Failed to exchange code for tokens: ${err.message}`);
      throw err;
    }

    oauth2Client.setCredentials(tokens);

    // Get user email from Google
    let googleEmail = '';
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      googleEmail = userInfo.data.email || '';
      this.logger.log(`[Callback] Got Google email: ${googleEmail}`);
    } catch (err: any) {
      this.logger.warn(`[Callback] Could not fetch user email: ${err.message}`);
      googleEmail = 'unknown';
    }

    // Upsert connection
    let connection = await this.connectionRepo.findOne({
      where: { userId: payload.userId },
    });

    if (connection) {
      connection.accessToken = tokens.access_token!;
      connection.refreshToken = tokens.refresh_token || connection.refreshToken;
      connection.tokenExpiry = new Date(tokens.expiry_date!);
      connection.googleEmail = googleEmail;
      connection.calendarSyncEnabled = true;
    } else {
      connection = this.connectionRepo.create({
        userId: payload.userId,
        organizationId: payload.orgId,
        googleEmail,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        tokenExpiry: new Date(tokens.expiry_date!),
        calendarSyncEnabled: true,
      });
    }

    await this.connectionRepo.save(connection);
    this.logger.log(`[Callback] Connection saved for user ${payload.userId}`);

    // Trigger initial sync (non-blocking)
    this.syncCalendarEvents(payload.userId).catch((err) => {
      this.logger.warn(`[Callback] Initial calendar sync failed: ${err.message}`);
    });
  }

  async getConnectionStatus(userId: string): Promise<{ connected: boolean; email: string | null }> {
    const connection = await this.connectionRepo.findOne({
      where: { userId },
    });

    if (!connection) {
      return { connected: false, email: null };
    }

    return { connected: true, email: connection.googleEmail };
  }

  async disconnect(userId: string): Promise<void> {
    await this.connectionRepo.delete({ userId });
  }

  async syncCalendarEvents(userId: string): Promise<void> {
    const connection = await this.connectionRepo.findOne({
      where: { userId },
    });

    if (!connection || !connection.calendarSyncEnabled) {
      return;
    }

    await this.refreshTokenIfNeeded(connection);

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: sevenDaysLater.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = (response as any).data?.items || [];

      for (const event of events) {
        if (!event.id || !event.summary) continue;

        const meetingUrl = this.extractMeetingUrl(event);
        const platform = this.detectPlatform(meetingUrl);

        // Only import events that are actually video meetings — skip flights,
        // birthdays, tasks, and other non-meeting calendar items that don't
        // have a Meet/Zoom/Teams URL attached.
        if (!meetingUrl || platform === MeetingPlatform.UNKNOWN) {
          continue;
        }

        const scheduledStart = event.start?.dateTime
          ? new Date(event.start.dateTime)
          : null;
        const scheduledEnd = event.end?.dateTime
          ? new Date(event.end.dateTime)
          : null;

        // Upsert meeting by google_event_id
        let meeting = await this.meetingRepo.findOne({
          where: {
            googleEventId: event.id,
            userId: connection.userId,
          },
        });

        const attendeeEmails = event.attendees
          ? event.attendees.map((a: any) => a.email).filter(Boolean)
          : [];

        if (meeting) {
          meeting.title = event.summary;
          meeting.meetingUrl = meetingUrl || '';
          meeting.platform = platform;
          meeting.scheduledStart = scheduledStart as any;
          meeting.scheduledEnd = scheduledEnd as any;
          meeting.participants = attendeeEmails;
        } else {
          meeting = this.meetingRepo.create({
            organizationId: connection.organizationId,
            userId: connection.userId,
            title: event.summary,
            meetingUrl: meetingUrl || '',
            platform,
            scheduledStart: scheduledStart as any,
            scheduledEnd: scheduledEnd as any,
            googleEventId: event.id,
            status: MeetingStatus.SCHEDULED,
            participants: attendeeEmails,
          } as any) as unknown as Meeting;
        }

        await this.meetingRepo.save(meeting as any);
      }

      // Update last sync time
      connection.lastSyncAt = new Date();
      await this.connectionRepo.save(connection);

      this.logger.log(`Synced ${events.length} calendar events for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to sync calendar events for user ${userId}: ${error.message}`);
    }
  }

  async refreshTokenIfNeeded(connection: GoogleCalendarConnection): Promise<void> {
    const now = new Date();
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes before expiry

    if (connection.tokenExpiry.getTime() - now.getTime() > expiryBuffer) {
      return; // Token is still valid
    }

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: connection.refreshToken,
    });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      connection.accessToken = credentials.access_token!;
      connection.tokenExpiry = new Date(credentials.expiry_date!);
      await this.connectionRepo.save(connection);
      this.logger.log(`Refreshed token for user ${connection.userId}`);
    } catch (error) {
      this.logger.error(`Failed to refresh token for user ${connection.userId}: ${error.message}`);
      throw error;
    }
  }

  private extractMeetingUrl(event: calendar_v3.Schema$Event): string | null {
    // Check conference data first (Google Meet)
    if (event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find(
        (ep) => ep.entryPointType === 'video',
      );
      if (videoEntry?.uri) {
        return videoEntry.uri;
      }
    }

    // Check description/location for meeting URLs
    const urlPattern = /https?:\/\/(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)\S+/i;
    const description = event.description || '';
    const location = event.location || '';

    const descMatch = description.match(urlPattern);
    if (descMatch) return descMatch[0];

    const locMatch = location.match(urlPattern);
    if (locMatch) return locMatch[0];

    return null;
  }

  private detectPlatform(meetingUrl: string | null): MeetingPlatform {
    if (!meetingUrl) return MeetingPlatform.UNKNOWN;

    if (meetingUrl.includes('meet.google.com')) return MeetingPlatform.GOOGLE_MEET;
    if (meetingUrl.includes('zoom.us')) return MeetingPlatform.ZOOM;
    if (meetingUrl.includes('teams.microsoft.com')) return MeetingPlatform.MICROSOFT_TEAMS;

    return MeetingPlatform.UNKNOWN;
  }

  @Cron('0 */15 * * * *')
  async handleCalendarSyncCron(): Promise<void> {
    this.logger.log('Running scheduled calendar sync for all connections');

    const connections = await this.connectionRepo.find({
      where: { calendarSyncEnabled: true as any },
    });

    for (const connection of connections) {
      try {
        await this.syncCalendarEvents(connection.userId);
      } catch (error) {
        this.logger.error(
          `Cron sync failed for user ${connection.userId}: ${error.message}`,
        );
      }
    }
  }
}
