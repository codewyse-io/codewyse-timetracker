import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import { PeerReviewSurvey, PeerReviewSurveyStatus } from './entities/peer-review-survey.entity';
import {
  PeerReviewResponse,
  PeerReviewResponseStatus,
} from './entities/peer-review-response.entity';
import { PeerReviewAnswer } from './entities/peer-review-answer.entity';
import {
  PEER_REVIEW_QUESTIONS,
  PeerReviewCategory,
  QUESTION_MAP,
} from './peer-review-questions';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { SubmitPeerReviewResponseDto } from './dto/submit-response.dto';
import { TeamsService } from '../teams/teams.service';

const SURVEY_OPEN_DAYS = 7;

@Injectable()
export class PeerReviewsService {
  private readonly logger = new Logger(PeerReviewsService.name);

  constructor(
    @InjectRepository(PeerReviewSurvey)
    private readonly surveyRepo: Repository<PeerReviewSurvey>,
    @InjectRepository(PeerReviewResponse)
    private readonly responseRepo: Repository<PeerReviewResponse>,
    @InjectRepository(PeerReviewAnswer)
    private readonly answerRepo: Repository<PeerReviewAnswer>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly teamsService: TeamsService,
  ) {}

  // ──────────────────────────────────────────────
  // Catalog
  // ──────────────────────────────────────────────

  getQuestions() {
    return PEER_REVIEW_QUESTIONS;
  }

  // ──────────────────────────────────────────────
  // Survey lifecycle
  // ──────────────────────────────────────────────

  /**
   * Cron: at 00:05 on day-1 of every month, open a survey for every org
   * covering the prior month. Survey stays open SURVEY_OPEN_DAYS days.
   * Also closes any surveys whose closesAt has passed.
   */
  @Cron('5 0 1 * *')
  async openMonthlySurveys(): Promise<void> {
    const orgIds = await this.userRepo
      .createQueryBuilder('u')
      .select('DISTINCT u.organization_id', 'organizationId')
      .where('u.organization_id IS NOT NULL')
      .getRawMany<{ organizationId: string }>();

    const periodMonth = previousMonthYYYYMM(new Date());
    const opensAt = new Date();
    const closesAt = new Date(opensAt.getTime() + SURVEY_OPEN_DAYS * 24 * 60 * 60 * 1000);

    for (const { organizationId } of orgIds) {
      if (!organizationId) continue;
      const exists = await this.surveyRepo.findOne({
        where: { organizationId, periodMonth },
      });
      if (exists) continue;

      const survey = this.surveyRepo.create({
        organizationId,
        periodMonth,
        opensAt,
        closesAt,
        status: PeerReviewSurveyStatus.OPEN,
      });
      await this.surveyRepo.save(survey);
      this.logger.log(
        `Opened peer-review survey ${periodMonth} for org ${organizationId} (closes ${closesAt.toISOString()})`,
      );
    }

    await this.autoCloseExpiredSurveys();
  }

  /**
   * Admin: manually open a survey for the current organization. Useful for
   * off-cycle reviews or first-time setup before the monthly cron fires.
   * - If a survey already exists for the period, returns it unchanged.
   * - Period defaults to the previous month (YYYY-MM).
   */
  async openSurveyNow(
    organizationId: string,
    options: { periodMonth?: string; openDays?: number } = {},
  ): Promise<PeerReviewSurvey> {
    const periodMonth = options.periodMonth || previousMonthYYYYMM(new Date());
    const openDays = options.openDays ?? SURVEY_OPEN_DAYS;

    const existing = await this.surveyRepo.findOne({
      where: { organizationId, periodMonth },
    });
    if (existing) return existing;

    const opensAt = new Date();
    const closesAt = new Date(opensAt.getTime() + openDays * 24 * 60 * 60 * 1000);
    const survey = this.surveyRepo.create({
      organizationId,
      periodMonth,
      opensAt,
      closesAt,
      status: PeerReviewSurveyStatus.OPEN,
    });
    return this.surveyRepo.save(survey);
  }

  /**
   * Runs hourly: close any survey whose window has expired.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoCloseExpiredSurveys(): Promise<void> {
    const now = new Date();
    const open = await this.surveyRepo.find({
      where: { status: PeerReviewSurveyStatus.OPEN },
    });
    for (const s of open) {
      if (s.closesAt <= now) {
        s.status = PeerReviewSurveyStatus.CLOSED;
        await this.surveyRepo.save(s);
        this.logger.log(`Closed peer-review survey ${s.id} (${s.periodMonth})`);
      }
    }
  }

  // ──────────────────────────────────────────────
  // Employee endpoints
  // ──────────────────────────────────────────────

  /**
   * The currently-open survey for this user's org, or null.
   * Teammates are scoped to the same team as the user. Users without a team
   * see an empty teammates list (the survey itself still exists).
   */
  async getActiveSurveyForUser(userId: string): Promise<{
    survey: PeerReviewSurvey;
    teammates: Array<{
      id: string;
      firstName: string;
      lastName: string;
      designation: string | null;
      responseId: string | null;
      status: PeerReviewResponseStatus | null;
    }>;
  } | null> {
    const me = await this.userRepo.findOne({ where: { id: userId } });
    if (!me || !me.organizationId) return null;

    const survey = await this.surveyRepo.findOne({
      where: {
        organizationId: me.organizationId,
        status: PeerReviewSurveyStatus.OPEN,
      },
      order: { opensAt: 'DESC' },
    });
    if (!survey) return null;

    const teammateIds = await this.teamsService.getTeammateIds(
      me.id,
      me.organizationId,
    );

    const teammates = teammateIds.size
      ? await this.userRepo.find({
          where: {
            id: In(Array.from(teammateIds)),
            organizationId: me.organizationId,
            status: UserStatus.ACTIVE,
            role: In([Role.EMPLOYEE, Role.ADMIN]),
          },
        })
      : [];

    const others = teammates;
    const responses = await this.responseRepo.find({
      where: {
        surveyId: survey.id,
        reviewerId: userId,
        revieweeId: In(others.map((u) => u.id)),
      },
    });
    const byReviewee = new Map(responses.map((r) => [r.revieweeId, r] as const));

    return {
      survey,
      teammates: others.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        designation: u.designation || null,
        responseId: byReviewee.get(u.id)?.id ?? null,
        status: byReviewee.get(u.id)?.status ?? null,
      })),
    };
  }

  /**
   * Load existing draft (if any) for a given reviewee in the active survey.
   */
  async getResponseDraft(
    reviewerId: string,
    surveyId: string,
    revieweeId: string,
  ) {
    const response = await this.responseRepo.findOne({
      where: { surveyId, reviewerId, revieweeId },
      relations: ['answers'],
    });
    return response;
  }

  /**
   * Submit (or update + submit) a peer-review response for one teammate.
   * Enforces:
   *  - reviewer & reviewee belong to the same org
   *  - reviewer != reviewee
   *  - survey is open
   *  - exactly one answer per defined question
   *  - score in 1..5
   *  - NOT all answers are 5 (no 100% positive)
   *  - NOT all answers are 1 (no 100% negative)
   */
  async submitResponse(
    reviewerId: string,
    surveyId: string,
    revieweeId: string,
    dto: SubmitPeerReviewResponseDto,
  ): Promise<PeerReviewResponse> {
    if (reviewerId === revieweeId) {
      throw new BadRequestException('You cannot review yourself.');
    }

    const survey = await this.surveyRepo.findOne({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Survey not found.');
    if (survey.status !== PeerReviewSurveyStatus.OPEN) {
      throw new BadRequestException('Survey is closed.');
    }
    if (survey.closesAt <= new Date()) {
      throw new BadRequestException('Survey window has ended.');
    }

    const [reviewer, reviewee] = await Promise.all([
      this.userRepo.findOne({ where: { id: reviewerId } }),
      this.userRepo.findOne({ where: { id: revieweeId } }),
    ]);
    if (!reviewer || !reviewee) {
      throw new NotFoundException('Reviewer or reviewee not found.');
    }
    if (
      !reviewer.organizationId ||
      reviewer.organizationId !== reviewee.organizationId ||
      reviewer.organizationId !== survey.organizationId
    ) {
      throw new ForbiddenException('Cross-organization reviews are not allowed.');
    }
    const share = await this.teamsService.shareTeam(
      reviewer.id,
      reviewee.id,
      reviewer.organizationId,
    );
    if (!share) {
      throw new ForbiddenException(
        'You can only review teammates you share a team with.',
      );
    }
    if (reviewee.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Reviewee is not an active team member.');
    }

    // Validate answer set
    const seen = new Set<string>();
    for (const a of dto.answers) {
      if (!QUESTION_MAP.has(a.questionKey)) {
        throw new BadRequestException(`Unknown question: ${a.questionKey}`);
      }
      if (seen.has(a.questionKey)) {
        throw new BadRequestException(`Duplicate question: ${a.questionKey}`);
      }
      seen.add(a.questionKey);
    }
    if (seen.size !== PEER_REVIEW_QUESTIONS.length) {
      throw new BadRequestException(
        `You must answer all ${PEER_REVIEW_QUESTIONS.length} questions.`,
      );
    }

    const allMax = dto.answers.every((a) => a.score === 5);
    const allMin = dto.answers.every((a) => a.score === 1);
    if (allMax) {
      throw new BadRequestException(
        'A response cannot be 100% positive. Please differentiate your ratings honestly.',
      );
    }
    if (allMin) {
      throw new BadRequestException(
        'A response cannot be 100% negative. Please differentiate your ratings honestly.',
      );
    }

    // Upsert response shell
    let response = await this.responseRepo.findOne({
      where: { surveyId, reviewerId, revieweeId },
      relations: ['answers'],
    });
    if (response && response.status === PeerReviewResponseStatus.SUBMITTED) {
      throw new BadRequestException(
        'You have already submitted a review for this teammate.',
      );
    }
    if (!response) {
      response = this.responseRepo.create({
        surveyId,
        reviewerId,
        revieweeId,
        status: PeerReviewResponseStatus.SUBMITTED,
        submittedAt: new Date(),
        comment: dto.comment ?? null,
      });
    } else {
      response.status = PeerReviewResponseStatus.SUBMITTED;
      response.submittedAt = new Date();
      response.comment = dto.comment ?? null;
      if (response.answers?.length) {
        await this.answerRepo.remove(response.answers);
      }
    }
    response = await this.responseRepo.save(response);

    const newAnswers = dto.answers.map((a) =>
      this.answerRepo.create({
        responseId: response!.id,
        questionKey: a.questionKey,
        category: QUESTION_MAP.get(a.questionKey)!.category,
        score: a.score,
      }),
    );
    await this.answerRepo.save(newAnswers);

    return this.responseRepo.findOne({
      where: { id: response.id },
      relations: ['answers'],
    }) as Promise<PeerReviewResponse>;
  }

  // ──────────────────────────────────────────────
  // Employee-visible leaderboard
  // ──────────────────────────────────────────────

  /**
   * List surveys (any status) visible to an employee — scoped to their org.
   */
  async listSurveysForUser(userId: string) {
    const me = await this.userRepo.findOne({ where: { id: userId } });
    if (!me?.organizationId) return [];
    return this.surveyRepo.find({
      where: { organizationId: me.organizationId },
      order: { opensAt: 'DESC' },
    });
  }

  /**
   * Public leaderboard of average peer-review scores per employee in the
   * requesting user's org, for a specific survey (or the most recent one
   * if surveyId is not provided). Reviewer identities are NOT returned —
   * this is the safe, employee-visible view.
   */
  async getLeaderboardForUser(userId: string, surveyId?: string) {
    const me = await this.userRepo.findOne({ where: { id: userId } });
    if (!me?.organizationId) return null;

    // Pick survey: if surveyId provided, validate org ownership.
    // Otherwise prefer most recent open survey, falling back to most recent overall.
    let survey: PeerReviewSurvey | null = null;
    if (surveyId) {
      survey = await this.surveyRepo.findOne({ where: { id: surveyId } });
      if (!survey || survey.organizationId !== me.organizationId) {
        throw new NotFoundException('Survey not found.');
      }
    } else {
      survey =
        (await this.surveyRepo.findOne({
          where: {
            organizationId: me.organizationId,
            status: PeerReviewSurveyStatus.OPEN,
          },
          order: { opensAt: 'DESC' },
        })) ||
        (await this.surveyRepo.findOne({
          where: { organizationId: me.organizationId },
          order: { opensAt: 'DESC' },
        }));
    }
    if (!survey) return null;

    const responses = await this.responseRepo.find({
      where: { surveyId: survey.id, status: PeerReviewResponseStatus.SUBMITTED },
      relations: ['answers', 'reviewee'],
    });

    type PerCategory = Record<PeerReviewCategory, { sum: number; count: number }>;
    const byReviewee = new Map<
      string,
      {
        reviewee: { id: string; firstName: string; lastName: string };
        reviewerCount: number;
        perCategory: PerCategory;
        overallSum: number;
        overallCount: number;
      }
    >();

    const emptyCat = (): PerCategory => ({
      [PeerReviewCategory.PERFORMANCE]: { sum: 0, count: 0 },
      [PeerReviewCategory.RESPONSIBILITY]: { sum: 0, count: 0 },
      [PeerReviewCategory.KNOWLEDGE]: { sum: 0, count: 0 },
      [PeerReviewCategory.LEADERSHIP_COLLABORATION]: { sum: 0, count: 0 },
    });

    for (const r of responses) {
      if (!byReviewee.has(r.revieweeId)) {
        byReviewee.set(r.revieweeId, {
          reviewee: {
            id: r.revieweeId,
            firstName: r.reviewee?.firstName ?? '',
            lastName: r.reviewee?.lastName ?? '',
          },
          reviewerCount: 0,
          perCategory: emptyCat(),
          overallSum: 0,
          overallCount: 0,
        });
      }
      const bucket = byReviewee.get(r.revieweeId)!;
      bucket.reviewerCount += 1;
      for (const a of r.answers || []) {
        bucket.perCategory[a.category].sum += a.score;
        bucket.perCategory[a.category].count += 1;
        bucket.overallSum += a.score;
        bucket.overallCount += 1;
      }
    }

    const rows = Array.from(byReviewee.values()).map((b) => ({
      reviewee: b.reviewee,
      reviewerCount: b.reviewerCount,
      overallAverage:
        b.overallCount > 0
          ? Math.round((b.overallSum / b.overallCount) * 100) / 100
          : 0,
      categoryAverages: {
        [PeerReviewCategory.PERFORMANCE]: avgB(b.perCategory[PeerReviewCategory.PERFORMANCE]),
        [PeerReviewCategory.RESPONSIBILITY]: avgB(b.perCategory[PeerReviewCategory.RESPONSIBILITY]),
        [PeerReviewCategory.KNOWLEDGE]: avgB(b.perCategory[PeerReviewCategory.KNOWLEDGE]),
        [PeerReviewCategory.LEADERSHIP_COLLABORATION]: avgB(
          b.perCategory[PeerReviewCategory.LEADERSHIP_COLLABORATION],
        ),
      },
    }));

    rows.sort((a, b) => b.overallAverage - a.overallAverage);

    return {
      survey: {
        id: survey.id,
        periodMonth: survey.periodMonth,
        opensAt: survey.opensAt,
        closesAt: survey.closesAt,
        status: survey.status,
      },
      results: rows,
      // Surface the current user's own rank for the "Your rank" widget.
      myEntry: rows.find((r) => r.reviewee.id === me.id) || null,
      myRank: (() => {
        const i = rows.findIndex((r) => r.reviewee.id === me.id);
        return i >= 0 ? i + 1 : null;
      })(),
    };
  }

  // ──────────────────────────────────────────────
  // Admin endpoints
  // ──────────────────────────────────────────────

  async listSurveys(organizationId: string) {
    const surveys = await this.surveyRepo.find({
      where: { organizationId },
      order: { opensAt: 'DESC' },
    });

    // Quick stats per survey
    const results: Array<{
      id: string;
      periodMonth: string;
      opensAt: Date;
      closesAt: Date;
      status: PeerReviewSurveyStatus;
      responseCount: number;
      participantCount: number;
    }> = [];
    for (const s of surveys) {
      const responseCount = await this.responseRepo.count({
        where: { surveyId: s.id, status: PeerReviewResponseStatus.SUBMITTED },
      });
      const participants = await this.responseRepo
        .createQueryBuilder('r')
        .select('COUNT(DISTINCT r.reviewer_id)', 'c')
        .where('r.survey_id = :sid', { sid: s.id })
        .andWhere('r.status = :st', { st: PeerReviewResponseStatus.SUBMITTED })
        .getRawOne<{ c: string }>();
      results.push({
        id: s.id,
        periodMonth: s.periodMonth,
        opensAt: s.opensAt,
        closesAt: s.closesAt,
        status: s.status,
        responseCount,
        participantCount: parseInt(participants?.c || '0', 10),
      });
    }
    return results;
  }

  async getSurveyResults(surveyId: string, organizationId: string) {
    const survey = await this.surveyRepo.findOne({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('Survey not found.');
    if (survey.organizationId !== organizationId) {
      throw new ForbiddenException();
    }

    const responses = await this.responseRepo.find({
      where: { surveyId, status: PeerReviewResponseStatus.SUBMITTED },
      relations: ['answers', 'reviewer', 'reviewee'],
    });

    // Aggregate per reviewee
    type PerCategory = Record<PeerReviewCategory, { sum: number; count: number }>;
    const byReviewee = new Map<
      string,
      {
        reviewee: { id: string; firstName: string; lastName: string };
        reviewerCount: number;
        perCategory: PerCategory;
        overallSum: number;
        overallCount: number;
        responses: Array<{
          id: string;
          reviewer: { id: string; firstName: string; lastName: string };
          submittedAt: Date | null;
          comment: string | null;
          answers: Array<{ questionKey: string; category: PeerReviewCategory; score: number }>;
        }>;
      }
    >();

    const emptyCat = (): PerCategory => ({
      [PeerReviewCategory.PERFORMANCE]: { sum: 0, count: 0 },
      [PeerReviewCategory.RESPONSIBILITY]: { sum: 0, count: 0 },
      [PeerReviewCategory.KNOWLEDGE]: { sum: 0, count: 0 },
      [PeerReviewCategory.LEADERSHIP_COLLABORATION]: { sum: 0, count: 0 },
    });

    for (const r of responses) {
      if (!byReviewee.has(r.revieweeId)) {
        byReviewee.set(r.revieweeId, {
          reviewee: {
            id: r.revieweeId,
            firstName: r.reviewee?.firstName ?? '',
            lastName: r.reviewee?.lastName ?? '',
          },
          reviewerCount: 0,
          perCategory: emptyCat(),
          overallSum: 0,
          overallCount: 0,
          responses: [],
        });
      }
      const bucket = byReviewee.get(r.revieweeId)!;
      bucket.reviewerCount += 1;
      for (const a of r.answers || []) {
        bucket.perCategory[a.category].sum += a.score;
        bucket.perCategory[a.category].count += 1;
        bucket.overallSum += a.score;
        bucket.overallCount += 1;
      }
      bucket.responses.push({
        id: r.id,
        reviewer: {
          id: r.reviewerId,
          firstName: r.reviewer?.firstName ?? '',
          lastName: r.reviewer?.lastName ?? '',
        },
        submittedAt: r.submittedAt,
        comment: r.comment,
        answers: (r.answers || []).map((a) => ({
          questionKey: a.questionKey,
          category: a.category,
          score: a.score,
        })),
      });
    }

    const rows = Array.from(byReviewee.values()).map((b) => ({
      reviewee: b.reviewee,
      reviewerCount: b.reviewerCount,
      overallAverage:
        b.overallCount > 0
          ? Math.round((b.overallSum / b.overallCount) * 100) / 100
          : 0,
      categoryAverages: {
        [PeerReviewCategory.PERFORMANCE]: avg(b.perCategory[PeerReviewCategory.PERFORMANCE]),
        [PeerReviewCategory.RESPONSIBILITY]: avg(b.perCategory[PeerReviewCategory.RESPONSIBILITY]),
        [PeerReviewCategory.KNOWLEDGE]: avg(b.perCategory[PeerReviewCategory.KNOWLEDGE]),
        [PeerReviewCategory.LEADERSHIP_COLLABORATION]: avg(
          b.perCategory[PeerReviewCategory.LEADERSHIP_COLLABORATION],
        ),
      },
      responses: b.responses,
    }));

    rows.sort((a, b) => b.overallAverage - a.overallAverage);

    return {
      survey: {
        id: survey.id,
        periodMonth: survey.periodMonth,
        opensAt: survey.opensAt,
        closesAt: survey.closesAt,
        status: survey.status,
      },
      results: rows,
    };
  }
}

function avg(b: { sum: number; count: number }): number {
  if (b.count === 0) return 0;
  return Math.round((b.sum / b.count) * 100) / 100;
}

const avgB = avg;

function previousMonthYYYYMM(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
