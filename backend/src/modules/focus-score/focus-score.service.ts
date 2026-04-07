import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DailyFocusScore } from './entities/daily-focus-score.entity';
import { WorkSession } from '../time-tracking/entities/work-session.entity';
import { IdleInterval } from '../time-tracking/entities/idle-interval.entity';
import { User } from '../users/entities/user.entity';
import { FocusCategory, getFocusCategory } from './enums/focus-category.enum';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class FocusScoreService {
  private readonly logger = new Logger(FocusScoreService.name);

  constructor(
    @InjectRepository(DailyFocusScore)
    private readonly focusScoreRepo: Repository<DailyFocusScore>,
    @InjectRepository(WorkSession)
    private readonly workSessionRepo: Repository<WorkSession>,
    @InjectRepository(IdleInterval)
    private readonly idleIntervalRepo: Repository<IdleInterval>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async calculateDailyScore(userId: string, date: string, organizationId?: string): Promise<DailyFocusScore> {
    const dayStart = `${date} 00:00:00`;
    const dayEnd = `${date} 23:59:59`;

    // Query all sessions for the user on that day
    const sessions = await this.workSessionRepo.find({
      where: {
        userId,
        startTime: Between(new Date(dayStart), new Date(dayEnd)),
      },
      relations: ['idleIntervals'],
    });

    let totalActiveTime = 0;
    let totalLoggedTime = 0;
    let idleInterruptions = 0;
    let productiveTime = 0;
    let unproductiveTime = 0;
    let neutralTime = 0;

    for (const session of sessions) {
      // For active sessions, compute durations live from startTime to now
      if (session.status === 'active') {
        const now = new Date();
        const liveTotal = Math.floor(
          (now.getTime() - session.startTime.getTime()) / 1000,
        );
        const liveIdle = session.idleDuration || 0;
        totalLoggedTime += liveTotal;
        totalActiveTime += Math.max(0, liveTotal - liveIdle);
      } else {
        totalLoggedTime += session.totalDuration;
        totalActiveTime += session.activeDuration;
      }
      idleInterruptions += session.idleIntervals?.length ?? 0;

      // Accumulate app productivity durations
      productiveTime += session.productiveDuration || 0;
      unproductiveTime += session.unproductiveDuration || 0;
      neutralTime += session.neutralDuration || 0;
    }

    // Calculate score
    let score = 0;
    if (totalLoggedTime > 0) {
      score = (totalActiveTime / totalLoggedTime) * 100;

      // App productivity bonus/penalty (only when activity data exists)
      const totalTrackedAppTime = productiveTime + unproductiveTime + neutralTime;
      if (totalTrackedAppTime > 0) {
        const productiveRatio = productiveTime / totalTrackedAppTime;
        const unproductiveRatio = unproductiveTime / totalTrackedAppTime;
        // Bonus up to +15 for productive, penalty up to -15 for unproductive
        const appAdjustment = (productiveRatio * 15) - (unproductiveRatio * 15);
        score += appAdjustment;
      }

      // Penalty: -2 points per idle interruption above 5
      const excessInterruptions = Math.max(0, idleInterruptions - 5);
      score -= excessInterruptions * 2;

      // Clamp
      score = Math.max(0, Math.min(100, score));
    }

    const category = getFocusCategory(score);

    // Upsert
    let focusScore = await this.focusScoreRepo.findOne({
      where: { userId, date },
    });

    const data = {
      score,
      category,
      totalActiveTime,
      totalLoggedTime,
      idleInterruptions,
      productiveTime,
      unproductiveTime,
      neutralTime,
    };

    if (focusScore) {
      Object.assign(focusScore, data);
    } else {
      focusScore = this.focusScoreRepo.create({ userId, date, ...data, ...(organizationId ? { organizationId } : {}) });
    }

    return this.focusScoreRepo.save(focusScore);
  }

  async getMyFocusScore(
    userId: string,
    period: 'daily' | 'weekly',
    organizationId?: string,
  ): Promise<DailyFocusScore[]> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let startDate: string;

    if (period === 'daily') {
      startDate = today;
    } else {
      // Last 7 days
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
    }

    // Always recalculate today's score live (handles active sessions)
    try {
      await this.calculateDailyScore(userId, today, organizationId);
    } catch (err) {
      this.logger.warn(`Live focus score recalculation failed: ${err.message}`);
    }

    const qb = this.focusScoreRepo
      .createQueryBuilder('fs')
      .where('fs.userId = :userId', { userId });

    if (organizationId) {
      qb.andWhere('fs.organizationId = :organizationId', { organizationId });
    }

    return qb
      .andWhere('fs.date >= :startDate', { startDate })
      .andWhere('fs.date <= :endDate', { endDate: today })
      .orderBy('fs.date', 'DESC')
      .getMany();
  }

  async getTeamFocusScores(
    organizationId: string,
    period: 'daily' | 'weekly',
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<DailyFocusScore>> {
    const now = new Date();
    let startDate: string;

    if (period === 'daily') {
      startDate = now.toISOString().split('T')[0];
    } else {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
    }

    const endDate = now.toISOString().split('T')[0];
    const skip = (page - 1) * limit;

    const [data, total] = await this.focusScoreRepo
      .createQueryBuilder('fs')
      .leftJoinAndSelect('fs.user', 'user')
      .where('fs.organizationId = :organizationId', { organizationId })
      .andWhere('fs.date >= :startDate', { startDate })
      .andWhere('fs.date <= :endDate', { endDate })
      .orderBy('fs.date', 'DESC')
      .addOrderBy('fs.score', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async calculateAllDailyScores(date: string, organizationId?: string): Promise<void> {
    this.logger.log(`Calculating daily focus scores for ${date}`);

    const whereClause: any = { status: 'active' as any };
    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const users = await this.userRepo.find({
      where: whereClause,
    });

    for (const user of users) {
      try {
        await this.calculateDailyScore(user.id, date, organizationId);
      } catch (error) {
        this.logger.error(
          `Failed to calculate focus score for user ${user.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Completed daily focus score calculations for ${date}`);
  }
}
