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

    // Auto-stop the bot + queue transcription when the meeting ends
    this.meetingBotService.events.on('meeting-ended', (data: { botId: string; meetingId: string; reason: string }) => {
      this.handleMeetingEndedAutomatically(data.meetingId, data.botId, data.reason).catch((err) => {
        this.logger.error(`[meeting-ended] Cleanup for meeting ${data.meetingId} failed: ${err.message}`);
      });
    });
  }

  /**
   * Called when the bot's end-watcher detects that the meeting has ended
   * (host ended the call, bot was kicked, browser closed, etc.). Mirrors
   * the stopRecording flow but without the user-auth check, since this is
   * triggered by the system not the user.
   */
  private async handleMeetingEndedAutomatically(meetingId: string, botId: string, reason: string): Promise<void> {
    this.logger.log(`[meeting-ended] Auto-stopping meeting ${meetingId} — reason: ${reason}`);
    const meeting = await this.meetingRepo.findOne({ where: { id: meetingId } });
    if (!meeting) {
      this.logger.warn(`[meeting-ended] Meeting ${meetingId} not found — skipping`);
      return;
    }
    if (meeting.status !== MeetingStatus.RECORDING) {
      this.logger.log(`[meeting-ended] Meeting ${meetingId} is already in status ${meeting.status} — skipping`);
      return;
    }

    // Stop the bot (closes browser, kills ffmpeg, cleans up PulseAudio)
    try {
      await this.meetingBotService.stopBot(botId);
    } catch (err: any) {
      this.logger.warn(`[meeting-ended] stopBot failed (continuing): ${err.message}`);
    }

    meeting.status = MeetingStatus.PROCESSING;
    await this.meetingRepo.save(meeting);

    await this.transcriptionQueue.add({ meetingId: meeting.id });
    this.logger.log(`[meeting-ended] Enqueued transcription for meeting ${meeting.id}`);

    if (this.realtimeGateway) {
      this.realtimeGateway.emitToUser(meeting.userId, 'meeting:status', {
        meetingId: meeting.id,
        status: 'processing',
      });
    }
  }

  async listMeetings(userId: string, orgId: string, query: MeetingQueryDto) {
    const { startDate, endDate, page, limit } = query;

    // Use the query builder so we can OR the date filter with `scheduledStart IS NULL`
    // — manually-joined meetings have no scheduledStart and shouldn't be filtered out
    // by a date range.
    const qb = this.meetingRepo
      .createQueryBuilder('meeting')
      .where('meeting.organizationId = :orgId', { orgId });

    if (startDate && endDate) {
      qb.andWhere(
        '(meeting.scheduledStart BETWEEN :startDate AND :endDate OR meeting.scheduledStart IS NULL)',
        { startDate: new Date(startDate), endDate: new Date(endDate) },
      );
    } else if (startDate) {
      qb.andWhere(
        '(meeting.scheduledStart >= :startDate OR meeting.scheduledStart IS NULL)',
        { startDate: new Date(startDate) },
      );
    } else if (endDate) {
      qb.andWhere(
        '(meeting.scheduledStart <= :endDate OR meeting.scheduledStart IS NULL)',
        { endDate: new Date(endDate) },
      );
    }

    const [data, total] = await qb
      .orderBy('meeting.scheduledStart', 'DESC')
      .addOrderBy('meeting.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
   * Reconcile stuck "recording" meetings. Runs every 5 minutes.
   * A meeting that shows "recording" but whose bot is no longer in the pool
   * is stale — usually because the server restarted mid-recording, the bot
   * crashed, or the end watcher missed the end signal. Mark such meetings
   * as failed so they don't linger forever in the UI.
   */
  @Cron('0 */5 * * * *')
  async reconcileStuckRecordings(): Promise<void> {
    const meetings = await this.meetingRepo.find({
      where: { status: MeetingStatus.RECORDING },
    });
    if (meetings.length === 0) return;

    let cleaned = 0;
    for (const meeting of meetings) {
      const botStillActive = meeting.recallBotId
        ? this.meetingBotService.getBotStatus(meeting.recallBotId) === 'active'
        : false;
      if (botStillActive) continue; // Bot is genuinely running, leave alone

      // Bot isn't in pool — treat this as a stale "recording" state. If we have
      // an audio file already saved, queue transcription; otherwise mark failed.
      const audioPath = meeting.recallBotId
        ? this.meetingBotService.getAudioFilePath(meeting.recallBotId)
        : null;

      if (audioPath) {
        this.logger.log(`[reconcile] Meeting ${meeting.id} has orphaned audio, queueing transcription`);
        meeting.status = MeetingStatus.PROCESSING;
        await this.meetingRepo.save(meeting);
        await this.transcriptionQueue.add({ meetingId: meeting.id });
      } else {
        this.logger.log(`[reconcile] Meeting ${meeting.id} stuck in recording with no active bot — marking failed`);
        meeting.status = MeetingStatus.FAILED;
        meeting.errorMessage = 'Bot stopped unexpectedly before transcription could complete';
        await this.meetingRepo.save(meeting);
      }

      if (this.realtimeGateway) {
        this.realtimeGateway.emitToUser(meeting.userId, 'meeting:status', {
          meetingId: meeting.id,
          status: meeting.status === MeetingStatus.PROCESSING ? 'processing' : 'failed',
        });
      }
      cleaned++;
    }

    if (cleaned > 0) {
      this.logger.log(`[reconcile] Cleaned up ${cleaned} stuck recording meeting(s)`);
    }
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
