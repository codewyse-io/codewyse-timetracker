import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { WorkSession } from './entities/work-session.entity';
import { IdleInterval } from './entities/idle-interval.entity';
import { SessionStatus } from './enums/session-status.enum';
import { ReportIdleDto } from './dto/report-idle.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { ShiftsService } from '../shifts/shifts.service';
import { FocusScoreService } from '../focus-score/focus-score.service';
import { AiService } from '../ai/ai.service';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class TimeTrackingService {
  private readonly logger = new Logger(TimeTrackingService.name);

  constructor(
    @InjectRepository(WorkSession)
    private readonly sessionRepository: Repository<WorkSession>,
    @InjectRepository(IdleInterval)
    private readonly idleRepository: Repository<IdleInterval>,
    private readonly shiftsService: ShiftsService,
    private readonly focusScoreService: FocusScoreService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Start a new work session for the user.
   * Validates no active session exists and optionally checks shift schedule.
   */
  async startSession(userId: string, shiftId?: string, mode: string = 'regular'): Promise<WorkSession> {
    // Check for existing active session
    const activeSession = await this.sessionRepository.findOne({
      where: { userId, status: SessionStatus.ACTIVE },
    });

    if (activeSession) {
      throw new ConflictException(
        'You already have an active session. Please stop it before starting a new one.',
      );
    }

    // Validate shift schedule only for regular mode
    if (mode === 'regular' && shiftId) {
      const withinShift = await this.shiftsService.isWithinShift(shiftId);
      if (!withinShift) {
        throw new BadRequestException(
          'You cannot start a session outside your assigned shift schedule.',
        );
      }
    }

    const session = this.sessionRepository.create({
      userId,
      startTime: new Date(),
      status: SessionStatus.ACTIVE,
      mode,
    });

    return this.sessionRepository.save(session);
  }

  /**
   * Stop the current active session for the user.
   * Calculates total, idle, and active durations.
   */
  async stopSession(userId: string): Promise<WorkSession> {
    const session = await this.sessionRepository.findOne({
      where: { userId, status: SessionStatus.ACTIVE },
      relations: ['idleIntervals'],
    });

    if (!session) {
      throw new NotFoundException('No active session found.');
    }

    session.endTime = new Date();
    session.status = SessionStatus.COMPLETED;
    this.calculateDurations(session);

    const savedSession = await this.sessionRepository.save(session);

    // Trigger focus score calculation and coaching tip generation asynchronously
    const sessionDate = session.startTime.toISOString().split('T')[0];
    this.focusScoreService.calculateDailyScore(userId, sessionDate).catch((err) => {
      this.logger.error(`Failed to calculate focus score: ${err.message}`);
    });

    this.aiService.generateCoachingTip(userId, {
      totalDuration: savedSession.totalDuration,
      activeDuration: savedSession.activeDuration,
      idleDuration: savedSession.idleDuration,
      idleInterruptions: savedSession.idleIntervals?.length ?? 0,
      mode: savedSession.mode,
    }).catch((err) => {
      this.logger.error(`Failed to generate coaching tip: ${err.message}`);
    });

    return savedSession;
  }

  /**
   * Get the current active session for the user, or null.
   */
  async getCurrentSession(userId: string): Promise<WorkSession | null> {
    return this.sessionRepository.findOne({
      where: { userId, status: SessionStatus.ACTIVE },
      relations: ['idleIntervals'],
    });
  }

  /**
   * Get all currently active sessions (admin view).
   */
  async getActiveSessions(): Promise<WorkSession[]> {
    return this.sessionRepository.find({
      where: { status: SessionStatus.ACTIVE },
      relations: ['user'],
      order: { startTime: 'DESC' },
    });
  }

  /**
   * Report an idle interval from the Electron client.
   * Supports upsert: if an idle interval with the same startTime already exists
   * for this session, it updates it (for ongoing idle tracking).
   */
  async reportIdle(
    userId: string,
    dto: ReportIdleDto,
  ): Promise<IdleInterval> {
    // Don't load idleIntervals relation — cascade: true causes issues on save
    const session = await this.sessionRepository.findOne({
      where: { userId, status: SessionStatus.ACTIVE },
    });

    if (!session) {
      this.logger.warn(`[reportIdle] No active session for user ${userId}`);
      throw new NotFoundException('No active session found to report idle time.');
    }

    const idleStart = new Date(dto.startTime);
    idleStart.setMilliseconds(0); // Normalize to second precision for DB matching
    const idleEnd = new Date(dto.endTime);

    this.logger.log(`[reportIdle] User ${userId} — start: ${idleStart.toISOString()}, end: ${idleEnd.toISOString()}, session: ${session.id}`);

    if (idleEnd <= idleStart) {
      this.logger.warn(`[reportIdle] Invalid range — end <= start`);
      throw new BadRequestException('Idle endTime must be after startTime.');
    }

    // Ensure idle interval falls within the session window
    if (idleStart < session.startTime) {
      this.logger.warn(`[reportIdle] Idle start ${idleStart.toISOString()} before session start ${session.startTime.toISOString()}`);
      throw new BadRequestException(
        'Idle startTime cannot be before the session startTime.',
      );
    }

    const durationSeconds = Math.floor(
      (idleEnd.getTime() - idleStart.getTime()) / 1000,
    );

    // Check for an existing idle interval with the same startTime (ongoing idle update)
    const existing = await this.idleRepository
      .createQueryBuilder('idle')
      .where('idle.session_id = :sessionId', { sessionId: session.id })
      .andWhere('idle.start_time = :startTime', { startTime: idleStart })
      .getOne();

    let saved: IdleInterval;
    if (existing) {
      // Update the existing ongoing idle interval
      this.logger.log(`[reportIdle] Updating existing interval ${existing.id} — new duration: ${durationSeconds}s`);
      existing.endTime = idleEnd;
      existing.duration = durationSeconds;
      saved = await this.idleRepository.save(existing);
    } else {
      this.logger.log(`[reportIdle] Creating new interval — duration: ${durationSeconds}s`);
      const idleInterval = this.idleRepository.create({
        sessionId: session.id,
        startTime: idleStart,
        endTime: idleEnd,
        duration: durationSeconds,
      });
      saved = await this.idleRepository.save(idleInterval);
    }

    // Recalculate session idle duration from all intervals using a direct update
    const { sum } = await this.idleRepository
      .createQueryBuilder('idle')
      .select('COALESCE(SUM(idle.duration), 0)', 'sum')
      .where('idle.session_id = :sessionId', { sessionId: session.id })
      .getRawOne();

    const totalIdle = parseInt(sum, 10) || 0;
    this.logger.log(`[reportIdle] Session ${session.id} total idle: ${totalIdle}s`);
    await this.sessionRepository.update(session.id, { idleDuration: totalIdle });

    // Generate a coaching tip for new idle events (not updates to existing ones)
    if (!existing && durationSeconds >= 60) {
      const sessionDuration = Math.floor(
        (Date.now() - session.startTime.getTime()) / 1000,
      );
      this.aiService.generateIdleTip(userId, durationSeconds, sessionDuration).catch((err) => {
        this.logger.error(`Failed to generate idle coaching tip: ${err.message}`);
      });
    }

    return saved;
  }

  /**
   * Get sessions with pagination and optional filters.
   */
  async getSessions(
    query: SessionQueryDto,
    requestingUserId?: string,
    isAdmin: boolean = false,
  ): Promise<PaginatedResponseDto<WorkSession>> {
    const { page, limit, startDate, endDate, userId } = query;

    const qb = this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .leftJoinAndSelect('session.idleIntervals', 'idle')
      .orderBy('session.startTime', 'DESC');

    // Non-admin users can only see their own sessions
    if (!isAdmin) {
      qb.andWhere('session.userId = :userId', { userId: requestingUserId });
    } else if (userId) {
      qb.andWhere('session.userId = :userId', { userId });
    }

    if (startDate) {
      qb.andWhere('session.startTime >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('session.startTime <= :endDate', { endDate: end });
    }

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Get sessions for a specific user within a date range (used by payroll).
   */
  async getSessionsByUser(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<WorkSession[]> {
    return this.sessionRepository.find({
      where: {
        userId,
        status: SessionStatus.COMPLETED,
        startTime: MoreThanOrEqual(startDate),
        endTime: LessThanOrEqual(endDate),
      },
      relations: ['idleIntervals'],
      order: { startTime: 'ASC' },
    });
  }

  /**
   * Return tracking settings for the user's assigned shift.
   * Falls back to default values if the user has no shift.
   */
  async getTrackingSettings(shiftId: string | undefined): Promise<{ idleThresholdSeconds: number }> {
    const DEFAULT_IDLE_MINUTES = 3;
    if (shiftId) {
      try {
        const shift = await this.shiftsService.findById(shiftId);
        return { idleThresholdSeconds: (shift.idleThresholdMinutes ?? DEFAULT_IDLE_MINUTES) * 60 };
      } catch {
        // shift not found — fall through to default
      }
    }
    return { idleThresholdSeconds: DEFAULT_IDLE_MINUTES * 60 };
  }

  /**
   * Calculate total, idle, and active durations for a session.
   */
  private calculateDurations(session: WorkSession): void {
    if (!session.endTime) return;

    const totalSeconds = Math.floor(
      (session.endTime.getTime() - session.startTime.getTime()) / 1000,
    );

    const idleSeconds =
      session.idleIntervals?.reduce((sum, idle) => sum + idle.duration, 0) ?? 0;

    session.totalDuration = totalSeconds;
    session.idleDuration = idleSeconds;
    session.activeDuration = Math.max(0, totalSeconds - idleSeconds);
  }
}
