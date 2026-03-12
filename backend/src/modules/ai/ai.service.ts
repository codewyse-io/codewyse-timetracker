import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiInsight, InsightType } from './entities/ai-insight.entity';
import { AiCoachingTip, CoachingCategory } from './entities/ai-coaching-tip.entity';

interface AiResponse {
  insight: string;
  recommendation: string;
}

interface SessionData {
  totalDuration?: number;
  activeDuration?: number;
  idleDuration?: number;
  idleInterruptions?: number;
  mode?: string;
}

interface TipTemplate {
  category: CoachingCategory;
  observation: string;
  recommendation: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AiInsight)
    private readonly insightRepo: Repository<AiInsight>,
    @InjectRepository(AiCoachingTip)
    private readonly coachingRepo: Repository<AiCoachingTip>,
  ) {}

  async generateInsight(
    userId: string,
    userData: any,
  ): Promise<AiInsight> {
    const prompt = `Analyze the following employee productivity data and provide an insight with a recommendation:\n${JSON.stringify(userData)}`;
    const result = await this.callAI(prompt);

    const insight = this.insightRepo.create({
      userId,
      type: InsightType.PRODUCTIVITY,
      insight: result.insight,
      recommendation: result.recommendation,
      generatedAt: new Date(),
    });

    return this.insightRepo.save(insight);
  }

  async generateCoachingTip(
    userId: string,
    userData: SessionData,
  ): Promise<AiCoachingTip> {
    const tip = this.analyzeSessionData(userData);

    const coachingTip = this.coachingRepo.create({
      userId,
      category: tip.category,
      observation: tip.observation,
      recommendation: tip.recommendation,
      generatedAt: new Date(),
    });

    return this.coachingRepo.save(coachingTip);
  }

  async generateIdleTip(
    userId: string,
    idleDurationSeconds: number,
    sessionDurationSeconds: number,
  ): Promise<AiCoachingTip> {
    const tip = this.analyzeIdleEvent(idleDurationSeconds, sessionDurationSeconds);

    const coachingTip = this.coachingRepo.create({
      userId,
      category: tip.category,
      observation: tip.observation,
      recommendation: tip.recommendation,
      generatedAt: new Date(),
    });

    return this.coachingRepo.save(coachingTip);
  }

  async generateTeamInsight(teamData: any): Promise<AiResponse> {
    const prompt = `Analyze this team-level productivity data and provide insights:\n${JSON.stringify(teamData)}`;
    return this.callAI(prompt);
  }

  async getInsightsForUser(userId: string): Promise<AiInsight[]> {
    return this.insightRepo.find({
      where: { userId },
      order: { generatedAt: 'DESC' },
      take: 20,
    });
  }

  async getTeamInsights(): Promise<AiInsight[]> {
    return this.insightRepo.find({
      where: { type: InsightType.TEAM },
      order: { generatedAt: 'DESC' },
      take: 20,
      relations: ['user'],
    });
  }

  async getCoachingTipsForUser(userId: string): Promise<AiCoachingTip[]> {
    return this.coachingRepo.find({
      where: { userId },
      order: { generatedAt: 'DESC' },
      take: 20,
    });
  }

  async getTeamCoachingTips(): Promise<AiCoachingTip[]> {
    return this.coachingRepo.find({
      order: { generatedAt: 'DESC' },
      take: 50,
      relations: ['user'],
    });
  }

  async getTeamCoachingGrouped(): Promise<
    { userId: string; user: { firstName: string; lastName: string }; tips: AiCoachingTip[] }[]
  > {
    const tips = await this.getTeamCoachingTips();
    const grouped = new Map<string, { user: { firstName: string; lastName: string }; tips: AiCoachingTip[] }>();

    for (const tip of tips) {
      if (!tip.user) continue;
      if (!grouped.has(tip.userId)) {
        grouped.set(tip.userId, {
          user: { firstName: tip.user.firstName, lastName: tip.user.lastName },
          tips: [],
        });
      }
      grouped.get(tip.userId)!.tips.push(tip);
    }

    return Array.from(grouped.entries()).map(([userId, data]) => ({
      userId,
      ...data,
    }));
  }

  /**
   * Analyze session data and return a contextual coaching tip.
   */
  private analyzeSessionData(data: SessionData): TipTemplate {
    const total = data.totalDuration || 0;
    const active = data.activeDuration || 0;
    const idle = data.idleDuration || 0;
    const interruptions = data.idleInterruptions || 0;
    const activePercent = total > 0 ? (active / total) * 100 : 0;
    const totalMinutes = Math.round(total / 60);
    const activeMinutes = Math.round(active / 60);
    const idleMinutes = Math.round(idle / 60);

    // High idle ratio
    if (activePercent < 60 && idle > 300) {
      return this.pickRandom([
        {
          category: CoachingCategory.PRODUCTIVITY,
          observation: `Your session had ${idleMinutes}m of idle time out of ${totalMinutes}m total (${Math.round(100 - activePercent)}% idle). This suggests frequent breaks or distractions during work.`,
          recommendation: 'Try the Pomodoro technique — work for 25 minutes, then take a 5-minute break. This helps maintain focus while still allowing rest.',
        },
        {
          category: CoachingCategory.TIME_USAGE,
          observation: `Only ${Math.round(activePercent)}% of your session was active work. You were idle for ${idleMinutes} minutes across ${interruptions} interruption(s).`,
          recommendation: 'Close unnecessary apps and notifications before starting focused work. Consider using "Do Not Disturb" mode during deep work blocks.',
        },
      ]);
    }

    // Too many interruptions
    if (interruptions >= 5) {
      return this.pickRandom([
        {
          category: CoachingCategory.PRODUCTIVITY,
          observation: `You had ${interruptions} idle interruptions during this session. Frequent context switches can reduce your productivity by up to 40%.`,
          recommendation: 'Batch your breaks together instead of taking many short ones. Set specific times to check messages or get up, rather than doing so ad hoc.',
        },
        {
          category: CoachingCategory.WORKLOAD,
          observation: `${interruptions} idle periods were detected in a ${totalMinutes}-minute session. This is higher than recommended for sustained productivity.`,
          recommendation: 'Try to identify what triggers your breaks — if it\'s fatigue, consider shorter but more focused sessions with proper rest in between.',
        },
      ]);
    }

    // Very short session
    if (total < 900 && total > 0) {
      return {
        category: CoachingCategory.TIME_USAGE,
        observation: `Your session was only ${totalMinutes} minutes long. Short sessions make it hard to enter a state of deep focus.`,
        recommendation: 'Aim for sessions of at least 30–60 minutes. It typically takes 15–20 minutes to reach peak concentration.',
      };
    }

    // Long session without breaks
    if (total > 7200 && interruptions <= 1) {
      return {
        category: CoachingCategory.WORKLOAD,
        observation: `You worked for ${totalMinutes} minutes with very few breaks. While impressive, long uninterrupted work can lead to burnout and decreased quality.`,
        recommendation: 'Take a 10-minute break every 90 minutes. Stand up, stretch, or step away from your screen to recharge your focus.',
      };
    }

    // Overtime session
    if (data.mode === 'overtime') {
      return this.pickRandom([
        {
          category: CoachingCategory.WORKLOAD,
          observation: `You logged ${totalMinutes} minutes of overtime with ${activeMinutes}m of active work. Consistent overtime can affect your well-being and long-term productivity.`,
          recommendation: 'If overtime is becoming regular, discuss workload distribution with your team lead. Sustainable work habits lead to better output over time.',
        },
        {
          category: CoachingCategory.TIME_USAGE,
          observation: `Overtime session completed: ${activeMinutes}m active out of ${totalMinutes}m total. Your focus rate was ${Math.round(activePercent)}%.`,
          recommendation: 'During overtime, prioritize high-impact tasks only. Save routine work for regular hours when energy levels are naturally higher.',
        },
      ]);
    }

    // Good session — positive reinforcement
    if (activePercent >= 80) {
      return this.pickRandom([
        {
          category: CoachingCategory.PRODUCTIVITY,
          observation: `Excellent focus! You maintained ${Math.round(activePercent)}% active time during your ${totalMinutes}-minute session with ${activeMinutes}m of productive work.`,
          recommendation: 'Keep up this momentum. Your work patterns show strong focus discipline. Consider tackling your most challenging tasks during these high-focus periods.',
        },
        {
          category: CoachingCategory.PRODUCTIVITY,
          observation: `Great session — ${activeMinutes} active minutes out of ${totalMinutes} total. Your idle time was minimal at just ${idleMinutes}m.`,
          recommendation: 'You\'re in a strong rhythm. To maintain this, ensure you\'re also taking adequate breaks between sessions to prevent fatigue buildup.',
        },
      ]);
    }

    // Default moderate session
    return this.pickRandom([
      {
        category: CoachingCategory.PRODUCTIVITY,
        observation: `Session completed: ${activeMinutes}m active, ${idleMinutes}m idle out of ${totalMinutes}m total. Your focus rate was ${Math.round(activePercent)}%.`,
        recommendation: 'To boost your focus score, try working in a distraction-free environment and setting clear goals before each session.',
      },
      {
        category: CoachingCategory.TIME_USAGE,
        observation: `You spent ${totalMinutes} minutes in this session with a ${Math.round(activePercent)}% active rate. There\'s room to improve your focus consistency.`,
        recommendation: 'Start each session by writing down your top 3 priorities. Having clear objectives helps maintain focus and reduces idle drift.',
      },
    ]);
  }

  /**
   * Analyze an idle event and return a contextual tip.
   */
  private analyzeIdleEvent(idleDurationSeconds: number, sessionDurationSeconds: number): TipTemplate {
    const idleMinutes = Math.round(idleDurationSeconds / 60);
    const sessionMinutes = Math.round(sessionDurationSeconds / 60);

    if (idleDurationSeconds > 600) {
      return this.pickRandom([
        {
          category: CoachingCategory.PRODUCTIVITY,
          observation: `You were idle for ${idleMinutes} minutes during an active session of ${sessionMinutes}m. Extended idle periods can break your flow state.`,
          recommendation: 'If you need a long break, consider pausing your session. This keeps your focus metrics accurate and helps track actual work time.',
        },
        {
          category: CoachingCategory.TIME_USAGE,
          observation: `A ${idleMinutes}-minute idle period was detected. This represents a significant portion of your current session.`,
          recommendation: 'If this was a meeting or planned break, that\'s perfectly fine. If unplanned, try to identify what pulled you away and plan for it next time.',
        },
      ]);
    }

    return this.pickRandom([
      {
        category: CoachingCategory.PRODUCTIVITY,
        observation: `Short idle period detected (${idleMinutes}m). Brief breaks are normal but frequent ones can fragment your focus.`,
        recommendation: 'Quick tip: If you need to step away briefly, try to finish your current thought or task first. This makes it easier to resume.',
      },
      {
        category: CoachingCategory.PRODUCTIVITY,
        observation: `You stepped away for ${idleMinutes} minutes during your work session.`,
        recommendation: 'Small breaks are healthy! Just try to batch them — one 10-minute break is better for focus than three 3-minute breaks.',
      },
    ]);
  }

  private pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Placeholder AI API call. Replace with actual API integration
   * (OpenAI, Claude, etc.) when ready.
   */
  private async callAI(prompt: string): Promise<AiResponse> {
    this.logger.debug(`AI prompt (mock): ${prompt.substring(0, 100)}...`);

    return {
      insight:
        'Based on the data provided, the employee shows consistent work patterns with room for improvement in reducing idle interruptions during peak hours.',
      recommendation:
        'Consider implementing focused work blocks of 90 minutes with scheduled breaks to maintain productivity and reduce context switching.',
    };
  }
}
