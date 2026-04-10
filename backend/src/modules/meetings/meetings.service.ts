import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository, Between, Not, IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Queue } from 'bull';
import { Cron } from '@nestjs/schedule';
import { Meeting, MeetingStatus, MeetingPlatform } from './entities/meeting.entity';
import { User } from '../users/entities/user.entity';
import { MeetingBotService } from '../bot/meeting-bot.service';
import { S3Service } from '../s3/s3.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingQueryDto } from './dto/meeting-query.dto';

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private meetingBotService: MeetingBotService,
    private s3Service: S3Service,
    @Optional() @Inject(forwardRef(() => RealtimeGateway))
    private realtimeGateway: RealtimeGateway,
    @InjectQueue('meeting-transcription') private transcriptionQueue: Queue,
  ) {
    // Relay live transcript events to users via WebSocket
    this.meetingBotService.events.on('transcript', (data) => {
      if (this.realtimeGateway) {
        this.meetingRepo.findOne({ where: { recallBotId: data.botId } }).then((meeting) => {
          if (meeting) {
            this.realtimeGateway.emitToUser(meeting.userId, 'meeting:live-transcript', {
              meetingId: meeting.id,
              speaker: data.speaker,
              text: data.text,
              timestamp: data.timestamp,
            });
          }
        });
      }
    });
  }

  async listMeetings(userId: string, orgId: string, query: MeetingQueryDto) {
    const { startDate, endDate, page, limit } = query;
    const where: any = { organizationId: orgId };

    if (startDate && endDate) {
      where.scheduledStart = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.scheduledStart = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      where.scheduledStart = LessThanOrEqual(new Date(endDate));
    }

    const [data, total] = await this.meetingRepo.findAndCount({
      where,
      order: { scheduledStart: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createManualMeeting(dto: CreateMeetingDto, userId: string, orgId: string) {
    const platform = this.detectPlatform(dto.meetingUrl);

    const meeting = this.meetingRepo.create({
      title: dto.title,
      meetingUrl: dto.meetingUrl,
      platform,
      status: MeetingStatus.SCHEDULED,
      userId,
      organizationId: orgId,
      scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
      scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
    });

    return this.meetingRepo.save(meeting);
  }

  async startRecording(meetingId: string, userId: string) {
    this.logger.log(`[startRecording] meetingId=${meetingId}, userId=${userId}`);
    const meeting = await this.findByIdOrFail(meetingId);
    if (meeting.userId !== userId) {
      throw new ForbiddenException('You do not own this meeting');
    }

    // Mark as joining and respond immediately. The bot launch (which takes
    // 10-30s for Puppeteer to navigate + click "Join") runs in the background.
    // Status changes flow through to the UI via WebSocket events.
    meeting.status = MeetingStatus.RECORDING;
    meeting.errorMessage = null as any;
    await this.meetingRepo.save(meeting);

    if (this.realtimeGateway) {
      this.realtimeGateway.emitToUser(meeting.userId, 'meeting:status', {
        meetingId: meeting.id,
        status: 'joining',
      });
    }

    // Fire-and-forget: launch bot in background
    this.launchBotInBackground(meeting.id, userId).catch((err) => {
      this.logger.error(`[startRecording] background bot launch crashed: ${err.message}`);
    });

    return meeting;
  }

  private async launchBotInBackground(meetingId: string, userId: string): Promise<void> {
    const meeting = await this.findByIdOrFail(meetingId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const botName = user?.firstName ? `${user.firstName}'s Notetaker` : 'Pulse Notetaker';

    try {
      const bot = await this.meetingBotService.createBot(meeting.meetingUrl, botName, meeting.id);
      meeting.recallBotId = bot.id;
      meeting.status = MeetingStatus.RECORDING;
      await this.meetingRepo.save(meeting);

      if (this.realtimeGateway) {
        this.realtimeGateway.emitToUser(meeting.userId, 'meeting:status', {
          meetingId: meeting.id,
          status: 'recording',
        });
      }
      this.logger.log(`[launchBot] Bot ${bot.id} active for meeting ${meeting.id}`);
    } catch (err: any) {
      this.logger.error(`[launchBot] Failed for meeting ${meeting.id}: ${err.message}`);
      this.logger.error(`[launchBot] Stack: ${err.stack}`);
      meeting.status = MeetingStatus.FAILED;
      meeting.errorMessage = err.message;
      await this.meetingRepo.save(meeting);

      if (this.realtimeGateway) {
        this.realtimeGateway.emitToUser(meeting.userId, 'meeting:status', {
          meetingId: meeting.id,
          status: 'failed',
          error: err.message,
        });
      }
    }
  }

  async stopRecording(meetingId: string, userId: string) {
    const meeting = await this.findByIdOrFail(meetingId);
    if (meeting.userId !== userId) {
      throw new ForbiddenException('You do not own this meeting');
    }

    if (!meeting.recallBotId) {
      throw new NotFoundException('No active bot for this meeting');
    }

    await this.meetingBotService.stopBot(meeting.recallBotId);
    meeting.status = MeetingStatus.PROCESSING;
    await this.meetingRepo.save(meeting);

    // Enqueue transcription job immediately after stopping
    await this.transcriptionQueue.add({ meetingId: meeting.id });
    this.logger.log(`Enqueued transcription job for meeting ${meeting.id}`);

    return meeting;
  }

  async getMeetingDetail(meetingId: string, userId: string) {
    const meeting = await this.findByIdOrFail(meetingId);

    let recordingUrl: string | null = null;
    if (meeting.recordingKey) {
      try {
        recordingUrl = await this.s3Service.getPresignedUrl(meeting.recordingKey);
      } catch (err) {
        this.logger.warn(`Failed to get presigned URL: ${err.message}`);
      }
    }

    return { ...meeting, recordingUrl };
  }

  async getRecordingUrl(meetingId: string, userId: string) {
    const meeting = await this.findByIdOrFail(meetingId);

    if (!meeting.recordingKey) {
      throw new NotFoundException('No recording available for this meeting');
    }

    const url = await this.s3Service.getPresignedUrl(meeting.recordingKey);
    return { url };
  }

  async deleteMeeting(meetingId: string, userId: string) {
    const meeting = await this.findByIdOrFail(meetingId);
    if (meeting.userId !== userId) {
      throw new ForbiddenException('You do not own this meeting');
    }

    await this.meetingRepo.remove(meeting);
    return { deleted: true };
  }

  /**
   * Auto-join cron — runs every 30 seconds.
   * Finds SCHEDULED meetings whose start time is within a window from
   * 1 minute in the future to 2 minutes in the past, then launches a bot
   * to join each one. The bot joins slightly *before* the scheduled start
   * so it's already in the meeting when it begins.
   */
  @Cron('*/30 * * * * *')
  async handleAutoJoinCron(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 2 * 60 * 1000); // 2 min ago
    const windowEnd = new Date(now.getTime() + 60 * 1000);       // 1 min from now

    const meetings = await this.meetingRepo.find({
      where: {
        status: MeetingStatus.SCHEDULED,
        scheduledStart: Between(windowStart, windowEnd),
        meetingUrl: Not(IsNull()),
      },
    });

    if (meetings.length === 0) return;
    this.logger.log(`[autoJoin] Found ${meetings.length} meeting(s) due to start`);

    for (const meeting of meetings) {
      if (!meeting.meetingUrl) continue;
      // Mark as joining immediately to prevent another cron tick from re-launching
      meeting.status = MeetingStatus.RECORDING;
      await this.meetingRepo.save(meeting);

      this.logger.log(`[autoJoin] Launching bot for meeting ${meeting.id} (${meeting.title}) — scheduledStart=${meeting.scheduledStart?.toISOString()}`);

      // Fire-and-forget so a slow bot launch doesn't hold up the cron tick
      this.launchBotInBackground(meeting.id, meeting.userId).catch((err) => {
        this.logger.error(`[autoJoin] background launch crashed for ${meeting.id}: ${err.message}`);
      });
    }
  }

  async findById(id: string): Promise<Meeting | null> {
    return this.meetingRepo.findOne({ where: { id } });
  }

  private async findByIdOrFail(id: string): Promise<Meeting> {
    const meeting = await this.meetingRepo.findOne({ where: { id } });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return meeting;
  }

  private detectPlatform(url: string): MeetingPlatform {
    if (url.includes('zoom.us')) return MeetingPlatform.ZOOM;
    if (url.includes('meet.google.com')) return MeetingPlatform.GOOGLE_MEET;
    if (url.includes('teams.microsoft.com') || url.includes('teams.live.com'))
      return MeetingPlatform.MICROSOFT_TEAMS;
    return MeetingPlatform.UNKNOWN;
  }
}
