import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiInsight, InsightType } from './entities/ai-insight.entity';
import { AiCoachingTip, CoachingCategory } from './entities/ai-coaching-tip.entity';

interface AiResponse {
  insight: string;
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
    userData: any,
  ): Promise<AiCoachingTip> {
    const prompt = `Based on this employee's work patterns, provide a coaching tip:\n${JSON.stringify(userData)}`;
    const result = await this.callAI(prompt);

    const tip = this.coachingRepo.create({
      userId,
      category: CoachingCategory.PRODUCTIVITY,
      observation: result.insight,
      recommendation: result.recommendation,
      generatedAt: new Date(),
    });

    return this.coachingRepo.save(tip);
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

  /**
   * Placeholder AI API call. Replace with actual API integration
   * (OpenAI, Claude, etc.) when ready.
   */
  private async callAI(prompt: string): Promise<AiResponse> {
    this.logger.debug(`AI prompt (mock): ${prompt.substring(0, 100)}...`);

    // Mock response — replace with actual HTTP call to AI provider
    // Example with fetch:
    // const response = await fetch(process.env.AI_API_URL, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.AI_API_KEY}`,
    //   },
    //   body: JSON.stringify({ prompt }),
    // });
    // const data = await response.json();

    return {
      insight:
        'Based on the data provided, the employee shows consistent work patterns with room for improvement in reducing idle interruptions during peak hours.',
      recommendation:
        'Consider implementing focused work blocks of 90 minutes with scheduled breaks to maintain productivity and reduce context switching.',
    };
  }
}
