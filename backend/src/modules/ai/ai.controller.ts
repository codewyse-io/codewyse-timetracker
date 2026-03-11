import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('AI Insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('insights/me')
  @ApiOperation({ summary: 'Get my AI insights (employee)' })
  async getMyInsights(@Req() req: any) {
    return this.aiService.getInsightsForUser(req.user.id);
  }

  @Get('insights/team')
  @Roles('admin')
  @ApiOperation({ summary: 'Get team AI insights (admin)' })
  async getTeamInsights() {
    return this.aiService.getTeamInsights();
  }

  @Get('coaching/me')
  @ApiOperation({ summary: 'Get my coaching tips (employee)' })
  async getMyCoachingTips(@Req() req: any) {
    return this.aiService.getCoachingTipsForUser(req.user.id);
  }

  @Get('coaching/team')
  @Roles('admin')
  @ApiOperation({ summary: 'Get team coaching tips (admin)' })
  async getTeamCoachingTips() {
    return this.aiService.getTeamCoachingTips();
  }

  @Post('insights/generate')
  @Roles('admin')
  @ApiOperation({ summary: 'Manually trigger insight generation (admin)' })
  async generateInsights(@Req() req: any) {
    // Placeholder: In production, this would iterate over users
    // and gather their data to generate insights
    const mockUserData = {
      totalHoursThisWeek: 40,
      focusScore: 78,
      idleInterruptions: 12,
    };

    const insight = await this.aiService.generateInsight(
      req.user.id,
      mockUserData,
    );

    return { message: 'Insight generation triggered', insight };
  }
}
