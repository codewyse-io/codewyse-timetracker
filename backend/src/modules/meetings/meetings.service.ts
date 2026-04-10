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

    // Build bot name from user's first name
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const botName = user?.firstName ? `${user.firstName}'s Notetaker` : 'Pulse Notetaker';

    let bot;
    try {
      bot = await this.meetingBotService.createBot(meeting.meetingUrl, botName, meeting.id);
    } catch (err: any) {
      this.logger.error(`[startRecording] Bot creation failed: ${err.message}`);
      this.logger.error(`[startRecording] Stack: ${err.stack}`);
      meeting.status = MeetingStatus.FAILED;
      meeting.errorMessage = err.message;
      await this.meetingRepo.save(meeting);
      throw err;
    }

    meeting.recallBotId = bot.id;
    meeting.status = MeetingStatus.RECORDING;
    await this.meetingRepo.save(meeting);

    if (this.realtimeGateway) {
      this.realtimeGateway.emitToUser(meeting.userId, 'meeting:status', {
        meetingId: meeting.id,
        status: 'recording',
      });
    }

    return meeting;
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

  @Cron('*/30 * * * * *')
  async handleAutoJoinCron(): Promise<void> {
    const now = new Date();
    const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);

    const meetings = await this.meetingRepo.find({
      where: {
        status: MeetingStatus.SCHEDULED,
        scheduledStart: Between(twoMinAgo, now),
        meetingUrl: Not(IsNull()),
      },
    });

    for (const meeting of meetings) {
      if (!meeting.meetingUrl) continue;
      try {
        const user = await this.userRepo.findOne({ where: { id: meeting.userId } });
        const botName = user?.firstName ? `${user.firstName}'s Notetaker` : 'Pulse Notetaker';
        const bot = await this.meetingBotService.createBot(meeting.meetingUrl, botName, meeting.id);
        meeting.recallBotId = bot.id;
        meeting.status = MeetingStatus.RECORDING;
        await this.meetingRepo.save(meeting);
        if (this.realtimeGateway) {
          this.realtimeGateway.emitToUser(meeting.userId, 'meeting:status', { meetingId: meeting.id, status: 'recording' });
        }
      } catch (err: any) {
        this.logger.error(`Auto-join failed for meeting ${meeting.id}: ${err.message}`);
      }
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
