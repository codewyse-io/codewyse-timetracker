import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorkSession } from './entities/work-session.entity';
import { IdleInterval } from './entities/idle-interval.entity';
import { SessionStatus } from './enums/session-status.enum';
import { ReportIdleDto } from './dto/report-idle.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { ShiftsService } from '../shifts/shifts.service';
import { FocusScoreService } from '../focus-score/focus-score.service';
import { AiService } from '../ai/ai.service';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

// ── Anti-manipulation constants ──────────────────────────────────────
const MAX_SESSION_DURATION_HOURS = 16;
const MAX_SINGLE_IDLE_SECONDS = 4 * 3600; // 4 hours max for one idle interval
const HEARTBEAT_TIMEOUT_SECONDS = 300; // 5 minutes — auto-stop if no heartbeat
const CLOCK_SKEW_TOLERANCE_SECONDS = 30; // allow 30s clock drift
const MAX_IDLE_INTERVALS_PER_SESSION = 500; // prevent abuse via interval flooding

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

    const now = new Date();
    const session = this.sessionRepository.create({
      userId,
      startTime: now,
      lastHeartbeat: now,
      status: SessionStatus.ACTIVE,
      mode,
    });

    const savedSession = await this.sessionRepository.save(session);

    // Generate an initial coaching tip and focus score so panels show data immediately
    this.aiService.generateSessionStartTip(userId, mode).catch((err) => {
      this.logger.error(`Failed to generate session start tip: ${err.message}`);
    });
    const today = new Date().toISOString().split('T')[0];
    this.focusScoreService.calculateDailyScore(userId, today).catch((err) => {
      this.logger.error(`Failed to calculate initial focus score: ${err.message}`);
    });

    return savedSession;
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
   * Record a heartbeat from the desktop client to prove it is running.
   * Also enforces max session duration and auto-stops regular sessions
   * when the user's shift ends.
   */
  async heartbeat(userId: string, shiftId?: string): Promise<{ ok: boolean; reason?: string }> {
    const session = await this.sessionRepository.findOne({
      where: { userId, status: SessionStatus.ACTIVE },
      relations: ['idleIntervals'],
    });

    if (!session) {
      throw new NotFoundException('No active session found.');
    }

    // Enforce max session duration
    const elapsed = (Date.now() - session.startTime.getTime()) / 1000;
    if (elapsed > MAX_SESSION_DURATION_HOURS * 3600) {
      this.logger.warn(`[heartbeat] Session ${session.id} exceeded max duration (${MAX_SESSION_DURATION_HOURS}h) — auto-stopping`);
      await this.autoStopSession(session);
      return { ok: false, reason: 'max-duration' };
    }

    // Auto-stop regular sessions when shift ends
    if (session.mode === 'regular' && shiftId) {
      try {
        const withinShift = await this.shiftsService.isWithinShift(shiftId);
        if (!withinShift) {
          this.logger.warn(`[heartbeat] Session ${session.id} is outside shift schedule — auto-stopping`);
          await this.autoStopSession(session);
          return { ok: false, reason: 'shift-ended' };
        }
      } catch (err) {
        // Shift lookup failed — don't block the heartbeat
        this.logger.error(`[heartbeat] Failed to check shift schedule: ${err.message}`);
      }
    }

    await this.sessionRepository.update(session.id, {
      lastHeartbeat: new Date(),
    });

    return { ok: true };
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
    const sessions = await this.sessionRepository.find({
      where: { status: SessionStatus.ACTIVE },
      relations: ['user'],
      order: { startTime: 'DESC' },
    });
    return this.computeLiveDurations(sessions);
  }

  /**
   * Report an idle interval from the Electron client.
   * Supports upsert: if an idle interval with the same startTime already exists
   * for this session, it updates it (for ongoing idle tracking).
   *
   * Anti-manipulation validations:
   * - Idle endTime cannot be in the future (+ clock skew tolerance)
   * - Single idle interval cannot exceed MAX_SINGLE_IDLE_SECONDS
   * - Total idle cannot exceed total session duration
   * - No overlapping idle intervals
   * - Max number of intervals per session
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
    const now = new Date();

    this.logger.log(`[reportIdle] User ${userId} — start: ${idleStart.toISOString()}, end: ${idleEnd.toISOString()}, session: ${session.id}`);

    // ── Validation 1: endTime must be after startTime ──
    if (idleEnd <= idleStart) {
      this.logger.warn(`[reportIdle] Invalid range — end <= start`);
      throw new BadRequestException('Idle endTime must be after startTime.');
    }

    // ── Validation 2: startTime cannot be before session start ──
    if (idleStart < session.startTime) {
      this.logger.warn(`[reportIdle] Idle start ${idleStart.toISOString()} before session start ${session.startTime.toISOString()}`);
      throw new BadRequestException(
        'Idle startTime cannot be before the session startTime.',
      );
    }

    // ── Validation 3: endTime cannot be in the future (with tolerance) ──
    const maxAllowedEnd = new Date(now.getTime() + CLOCK_SKEW_TOLERANCE_SECONDS * 1000);
    if (idleEnd > maxAllowedEnd) {
      this.logger.warn(`[reportIdle] Idle endTime ${idleEnd.toISOString()} is in the future (now: ${now.toISOString()})`);
      throw new BadRequestException('Idle endTime cannot be in the future.');
    }

    const durationSeconds = Math.floor(
      (idleEnd.getTime() - idleStart.getTime()) / 1000,
    );

    // ── Validation 4: single idle interval max duration ──
    if (durationSeconds > MAX_SINGLE_IDLE_SECONDS) {
      this.logger.warn(`[reportIdle] Idle duration ${durationSeconds}s exceeds max ${MAX_SINGLE_IDLE_SECONDS}s`);
      throw new BadRequestException(
        `Single idle interval cannot exceed ${MAX_SINGLE_IDLE_SECONDS / 3600} hours.`,
      );
    }

    // ── Validation 5: total idle cannot exceed session elapsed time ──
    const sessionElapsed = Math.floor((now.getTime() - session.startTime.getTime()) / 1000);
    const currentTotalIdle = session.idleDuration || 0;
    // For upsert, we need to check the net change
    const existing = await this.idleRepository
      .createQueryBuilder('idle')
      .where('idle.session_id = :sessionId', { sessionId: session.id })
      .andWhere('idle.start_time = :startTime', { startTime: idleStart })
      .getOne();

    const previousDuration = existing?.duration || 0;
    const netIncrease = durationSeconds - previousDuration;
    if (currentTotalIdle + netIncrease > sessionElapsed) {
      this.logger.warn(`[reportIdle] Total idle (${currentTotalIdle + netIncrease}s) would exceed session elapsed (${sessionElapsed}s)`);
      throw new BadRequestException('Total idle time cannot exceed session duration.');
    }

    // ── Validation 6: check for overlapping intervals (skip the one being updated) ──
    if (!existing) {
      const overlapQb = this.idleRepository
        .createQueryBuilder('idle')
        .where('idle.session_id = :sessionId', { sessionId: session.id })
        .andWhere('idle.start_time < :idleEnd', { idleEnd })
        .andWhere('idle.end_time > :idleStart', { idleStart });

      const overlapCount = await overlapQb.getCount();
      if (overlapCount > 0) {
        this.logger.warn(`[reportIdle] Overlapping idle interval detected`);
        throw new BadRequestException('Idle intervals cannot overlap.');
      }
    }

    // ── Validation 7: max intervals per session ──
    if (!existing) {
      const intervalCount = await this.idleRepository.count({
        where: { sessionId: session.id },
      });
      if (intervalCount >= MAX_IDLE_INTERVALS_PER_SESSION) {
        this.logger.warn(`[reportIdle] Max idle intervals (${MAX_IDLE_INTERVALS_PER_SESSION}) reached for session ${session.id}`);
        throw new BadRequestException('Maximum idle intervals reached for this session.');
      }
    }

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
   * Cron job: auto-stop sessions with stale heartbeats.
   * Runs every 2 minutes.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleSessionsCron(): Promise<void> {
    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_SECONDS * 1000);

    const staleSessions = await this.sessionRepository.find({
      where: {
        status: SessionStatus.ACTIVE,
        lastHeartbeat: LessThan(cutoff),
      },
      relations: ['idleIntervals'],
    });

    for (const session of staleSessions) {
      this.logger.warn(`[stale-check] Auto-stopping stale session ${session.id} (user: ${session.userId}, last heartbeat: ${session.lastHeartbeat?.toISOString()})`);
      await this.autoStopSession(session);
    }

    // Also auto-stop sessions exceeding max duration
    const maxDurationCutoff = new Date(Date.now() - MAX_SESSION_DURATION_HOURS * 3600 * 1000);
    const longSessions = await this.sessionRepository.find({
      where: {
        status: SessionStatus.ACTIVE,
        startTime: LessThan(maxDurationCutoff),
      },
      relations: ['idleIntervals'],
    });

    for (const session of longSessions) {
      this.logger.warn(`[stale-check] Auto-stopping over-max-duration session ${session.id} (user: ${session.userId})`);
      await this.autoStopSession(session);
    }

    // Auto-stop regular sessions whose shift has ended
    const regularSessions = await this.sessionRepository.find({
      where: {
        status: SessionStatus.ACTIVE,
        mode: 'regular',
      },
      relations: ['user', 'idleIntervals'],
    });

    for (const session of regularSessions) {
      const shiftId = session.user?.shiftId;
      if (!shiftId) continue;
      try {
        const withinShift = await this.shiftsService.isWithinShift(shiftId);
        if (!withinShift) {
          this.logger.warn(`[stale-check] Auto-stopping session ${session.id} — shift ended (user: ${session.userId})`);
          await this.autoStopSession(session);
        }
      } catch {
        // Shift not found — skip
      }
    }
  }

  /**
   * Auto-stop a session: set endTime to last heartbeat (not current time)
   * so the user doesn't get credit for time the app wasn't running.
   */
  private async autoStopSession(session: WorkSession): Promise<void> {
    // End at last heartbeat time, not now — prevents inflating hours when app crashes
    session.endTime = session.lastHeartbeat || new Date();
    session.status = SessionStatus.COMPLETED;
    this.calculateDurations(session);
    await this.sessionRepository.save(session);

    const sessionDate = session.startTime.toISOString().split('T')[0];
    this.focusScoreService.calculateDailyScore(session.userId, sessionDate).catch(() => {});
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
    this.computeLiveDurations(data);

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
    // Idle cannot exceed total — clamp it
    session.idleDuration = Math.min(idleSeconds, totalSeconds);
    session.activeDuration = Math.max(0, totalSeconds - session.idleDuration);
  }

  /**
   * For active (in-progress) sessions, compute live durations on the fly
   * since they are only persisted when the session is stopped.
   */
  private computeLiveDurations(sessions: WorkSession[]): WorkSession[] {
    const now = Date.now();
    for (const session of sessions) {
      if (session.status === SessionStatus.ACTIVE) {
        const totalSeconds = Math.floor(
          (now - new Date(session.startTime).getTime()) / 1000,
        );
        const idleSeconds = session.idleDuration || 0;
        session.totalDuration = totalSeconds;
        session.activeDuration = Math.max(0, totalSeconds - idleSeconds);
      }
    }
    return sessions;
  }
}
