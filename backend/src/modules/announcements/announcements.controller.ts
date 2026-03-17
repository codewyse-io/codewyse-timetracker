import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new announcement (admin only)' })
  create(@Req() req: any, @Body() dto: CreateAnnouncementDto) {
    return this.announcementsService.create(dto, req.user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all announcements (admin)' })
  findAll() {
    return this.announcementsService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active announcements (all users)' })
  findActive() {
    return this.announcementsService.findActive();
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate an announcement (admin)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcementsService.deactivate(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete an announcement (admin)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.announcementsService.delete(id);
  }
}
