import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('AI Insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('insights')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my AI insights (employee)' })
  async getMyInsights(@Req() req: any) {
    return this.aiService.getInsightsForUser(req.user.id);
  }

  @Get('coaching/me')
  @ApiOperation({ summary: 'Get my coaching tips (employee)' })
  async getMyCoachingTips(@Req() req: any) {
    return this.aiService.getCoachingTipsForUser(req.user.id);
  }

  @Get('team')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get team AI insights (admin)' })
  async getTeamInsights() {
    return this.aiService.getTeamInsights();
  }

  @Get('coaching')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get team coaching tips grouped by employee (admin)' })
  async getTeamCoachingGrouped() {
    return this.aiService.getTeamCoachingGrouped();
  }

  @Get('employee/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get insights and coaching for a specific employee (admin)' })
  async getEmployeeInsights(@Param('userId', ParseUUIDPipe) userId: string) {
    const [insights, coaching] = await Promise.all([
      this.aiService.getInsightsForUser(userId),
      this.aiService.getCoachingTipsForUser(userId),
    ]);
    return { insights, coaching };
  }

  @Post('generate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually trigger insight generation (admin)' })
  async generateInsights(@Req() req: any) {
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
