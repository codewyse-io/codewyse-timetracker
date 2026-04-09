import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { MeetingQueryDto } from './dto/meeting-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Meetings')
@ApiBearerAuth()
@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  list(@Req() req, @CurrentOrg() orgId: string, @Query() query: MeetingQueryDto) {
    return this.meetingsService.listMeetings(req.user.id, orgId, query);
  }

  @Post()
  create(@Req() req, @CurrentOrg() orgId: string, @Body() dto: CreateMeetingDto) {
    return this.meetingsService.createManualMeeting(dto, req.user.id, orgId);
  }

  @Post(':id/record')
  startRecording(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.startRecording(id, req.user.id);
  }

  @Post(':id/stop')
  stopRecording(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.stopRecording(id, req.user.id);
  }

  @Get(':id')
  getDetail(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.getMeetingDetail(id, req.user.id);
  }

  @Get(':id/recording-url')
  getRecordingUrl(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.getRecordingUrl(id, req.user.id);
  }

  @Delete(':id')
  delete(@Req() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.deleteMeeting(id, req.user.id);
  }
}
