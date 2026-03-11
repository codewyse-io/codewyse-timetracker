import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FocusScoreService } from './focus-score.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Focus Score')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('focus-score')
export class FocusScoreController {
  constructor(private readonly focusScoreService: FocusScoreService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my focus scores' })
  @ApiQuery({ name: 'period', enum: ['daily', 'weekly'], required: false })
  async getMyFocusScore(
    @Req() req: any,
    @Query('period') period: 'daily' | 'weekly' = 'daily',
  ) {
    return this.focusScoreService.getMyFocusScore(req.user.id, period);
  }

  @Get('team')
  @Roles('admin')
  @ApiOperation({ summary: 'Get team focus scores (admin)' })
  @ApiQuery({ name: 'period', enum: ['daily', 'weekly'], required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getTeamFocusScores(
    @Query('period') period: 'daily' | 'weekly' = 'daily',
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.focusScoreService.getTeamFocusScores(period, +page, +limit);
  }
}
