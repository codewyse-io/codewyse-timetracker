import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TimeTrackingService } from './time-tracking.service';
import { StartSessionDto } from './dto/start-session.dto';
import { ReportIdleDto } from './dto/report-idle.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { WorkSession } from './entities/work-session.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Time Tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-tracking')
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new work session (employee)' })
  async startSession(
    @Body() dto: StartSessionDto,
    @Req() req: any,
  ): Promise<WorkSession> {
    const userId = req.user?.id;
    const shiftId = req.user?.shiftId;
    const mode = dto.mode || 'regular';
    return this.timeTrackingService.startSession(userId, shiftId, mode);
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop the current work session (employee)' })
  async stopSession(@Req() req: any): Promise<WorkSession> {
    return this.timeTrackingService.stopSession(req.user?.id);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the current active session (employee)' })
  async getCurrentSession(
    @Req() req: any,
  ): Promise<WorkSession | null> {
    return this.timeTrackingService.getCurrentSession(req.user?.id);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get tracking settings for the current user (idle threshold from their shift)' })
  async getTrackingSettings(@Req() req: any) {
    return this.timeTrackingService.getTrackingSettings(req.user?.shiftId);
  }

  @Post('idle')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Report idle time from Electron client (employee)',
  })
  async reportIdle(
    @Body() dto: ReportIdleDto,
    @Req() req: any,
  ) {
    return this.timeTrackingService.reportIdle(req.user?.id, dto);
  }

  @Get('sessions/active')
  @ApiOperation({ summary: 'Get all active sessions (admin)' })
  async getActiveSessions(
    @Req() req: any,
  ): Promise<WorkSession[]> {
    return this.timeTrackingService.getActiveSessions();
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'Get work sessions (admin sees all, employee sees own)',
  })
  async getSessions(
    @Query() query: SessionQueryDto,
    @Req() req: any,
  ): Promise<PaginatedResponseDto<WorkSession>> {
    const isAdmin = req.user?.role === 'admin';
    return this.timeTrackingService.getSessions(
      query,
      req.user?.id,
      isAdmin,
    );
  }
}
