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

  async calculateDailyScore(userId: string, date: string): Promise<DailyFocusScore> {
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

    for (const session of sessions) {
      totalLoggedTime += session.totalDuration;
      totalActiveTime += session.activeDuration;
      idleInterruptions += session.idleIntervals?.length ?? 0;
    }

    // Calculate score
    let score = 0;
    if (totalLoggedTime > 0) {
      score = (totalActiveTime / totalLoggedTime) * 100;

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

    if (focusScore) {
      focusScore.score = score;
      focusScore.category = category;
      focusScore.totalActiveTime = totalActiveTime;
      focusScore.totalLoggedTime = totalLoggedTime;
      focusScore.idleInterruptions = idleInterruptions;
    } else {
      focusScore = this.focusScoreRepo.create({
        userId,
        date,
        score,
        category,
        totalActiveTime,
        totalLoggedTime,
        idleInterruptions,
      });
    }

    return this.focusScoreRepo.save(focusScore);
  }

  async getMyFocusScore(
    userId: string,
    period: 'daily' | 'weekly',
  ): Promise<DailyFocusScore[]> {
    const now = new Date();
    let startDate: string;

    if (period === 'daily') {
      startDate = now.toISOString().split('T')[0];
    } else {
      // Last 7 days
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
    }

    const endDate = now.toISOString().split('T')[0];

    return this.focusScoreRepo
      .createQueryBuilder('fs')
      .where('fs.userId = :userId', { userId })
      .andWhere('fs.date >= :startDate', { startDate })
      .andWhere('fs.date <= :endDate', { endDate })
      .orderBy('fs.date', 'DESC')
      .getMany();
  }

  async getTeamFocusScores(
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
      .where('fs.date >= :startDate', { startDate })
      .andWhere('fs.date <= :endDate', { endDate })
      .orderBy('fs.date', 'DESC')
      .addOrderBy('fs.score', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async calculateAllDailyScores(date: string): Promise<void> {
    this.logger.log(`Calculating daily focus scores for ${date}`);

    const users = await this.userRepo.find({
      where: { status: 'active' as any },
    });

    for (const user of users) {
      try {
        await this.calculateDailyScore(user.id, date);
      } catch (error) {
        this.logger.error(
          `Failed to calculate focus score for user ${user.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Completed daily focus score calculations for ${date}`);
  }
}
