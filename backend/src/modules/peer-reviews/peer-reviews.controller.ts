import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PeerReviewsService } from './peer-reviews.service';
import { SubmitPeerReviewResponseDto } from './dto/submit-response.dto';
import { PeerReviewResponseKind } from './entities/peer-review-response.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Peer Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('peer-reviews')
export class PeerReviewsController {
  constructor(private readonly service: PeerReviewsService) {}

  // ── Catalog ──
  @Get('questions')
  @ApiOperation({ summary: 'Get the peer-review question catalog (team or hr)' })
  getQuestions(@Query('kind') kind?: 'team' | 'hr') {
    return this.service.getQuestions(kind === 'hr' ? 'hr' : 'team');
  }

  @Get('questions/all')
  @ApiOperation({ summary: 'Get all question catalogs in one call ({ team, hr })' })
  getAllQuestions() {
    return this.service.getAllQuestions();
  }

  // ── Employee ──
  @Get('active')
  @ApiOperation({ summary: 'Get the active survey for the current user (or null)' })
  async active(@Req() req: any) {
    return this.service.getActiveSurveyForUser(req.user.id);
  }

  @Get(':surveyId/responses/:revieweeId')
  @ApiOperation({ summary: 'Load existing draft/submitted response for a teammate' })
  async getDraft(
    @Req() req: any,
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Param('revieweeId', ParseUUIDPipe) revieweeId: string,
    @Query('kind') kind?: 'team' | 'hr',
  ) {
    return this.service.getResponseDraft(
      req.user.id,
      surveyId,
      revieweeId,
      kind === 'hr' ? PeerReviewResponseKind.HR : PeerReviewResponseKind.TEAM,
    );
  }

  @Post(':surveyId/responses/:revieweeId')
  @ApiOperation({ summary: 'Submit a peer-review response (team review)' })
  async submit(
    @Req() req: any,
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Param('revieweeId', ParseUUIDPipe) revieweeId: string,
    @Body() dto: SubmitPeerReviewResponseDto,
    @Query('kind') kind?: 'team' | 'hr',
  ) {
    return this.service.submitResponse(
      req.user.id,
      surveyId,
      revieweeId,
      dto,
      kind === 'hr' ? PeerReviewResponseKind.HR : PeerReviewResponseKind.TEAM,
    );
  }

  @Post(':surveyId/hr-responses/:revieweeId')
  @ApiOperation({ summary: 'Submit an HR review response (for users marked is_hr = true)' })
  async submitHr(
    @Req() req: any,
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Param('revieweeId', ParseUUIDPipe) revieweeId: string,
    @Body() dto: SubmitPeerReviewResponseDto,
  ) {
    return this.service.submitResponse(
      req.user.id,
      surveyId,
      revieweeId,
      dto,
      PeerReviewResponseKind.HR,
    );
  }

  @Get(':surveyId/hr-responses/:revieweeId')
  @ApiOperation({ summary: 'Load existing HR-review draft for a person marked HR' })
  async getHrDraft(
    @Req() req: any,
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Param('revieweeId', ParseUUIDPipe) revieweeId: string,
  ) {
    return this.service.getResponseDraft(
      req.user.id,
      surveyId,
      revieweeId,
      PeerReviewResponseKind.HR,
    );
  }

  // ── My feedback (anonymous view of reviews ABOUT the current user) ──
  @Get('my-feedback')
  @ApiOperation({ summary: 'Get anonymized feedback received by the current user (HR-focused)' })
  async myFeedback(
    @Req() req: any,
    @Query('surveyId') surveyId?: string,
    @Query('kind') kind?: 'team' | 'hr',
  ) {
    return this.service.getMyFeedback(req.user.id, { surveyId, kind });
  }

  // ── Leaderboard (visible to all authenticated users in the org) ──
  @Get('leaderboard')
  @ApiOperation({ summary: 'Org-wide leaderboard of peer-review averages' })
  async leaderboard(
    @Req() req: any,
    @Query('surveyId') surveyId?: string,
  ) {
    return this.service.getLeaderboardForUser(req.user.id, surveyId);
  }

  @Get('surveys')
  @ApiOperation({ summary: 'List all surveys in my organization' })
  async surveys(@Req() req: any) {
    return this.service.listSurveysForUser(req.user.id);
  }

  // ── Admin ──
  @Get('admin/surveys')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List peer-review surveys for the organization' })
  async listSurveys(@CurrentOrg() orgId: string) {
    return this.service.listSurveys(orgId);
  }

  @Post('admin/surveys/open')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually open a peer-review survey (off-cycle or initial setup)' })
  async openSurvey(
    @CurrentOrg() orgId: string,
    @Body() body: { periodMonth?: string; openDays?: number } = {},
  ) {
    return this.service.openSurveyNow(orgId, body);
  }

  @Get('admin/surveys/:surveyId/results')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Aggregated team-review results for a survey (or HR with ?kind=hr)' })
  async surveyResults(
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @CurrentOrg() orgId: string,
    @Query('kind') kind?: 'team' | 'hr',
  ) {
    return this.service.getSurveyResults(
      surveyId,
      orgId,
      kind === 'hr' ? PeerReviewResponseKind.HR : PeerReviewResponseKind.TEAM,
    );
  }
}
