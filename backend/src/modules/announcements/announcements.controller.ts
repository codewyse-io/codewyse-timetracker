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
import { HrAllowed } from '../../common/decorators/hr-allowed.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @HrAllowed()
  @ApiOperation({ summary: 'Create a new announcement (admin / HR)' })
  create(@Req() req: any, @Body() dto: CreateAnnouncementDto, @CurrentOrg() orgId: string) {
    return this.announcementsService.create(dto, req.user.id, orgId);
  }

  @Get()
  @Roles(Role.ADMIN)
  @HrAllowed()
  @ApiOperation({ summary: 'List all announcements (admin / HR)' })
  findAll(@CurrentOrg() orgId: string) {
    return this.announcementsService.findAll(orgId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active announcements (all users)' })
  findActive(@CurrentOrg() orgId: string) {
    return this.announcementsService.findActive(orgId);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  @HrAllowed()
  @ApiOperation({ summary: 'Deactivate an announcement (admin / HR)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentOrg() orgId: string) {
    return this.announcementsService.deactivate(id, orgId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HrAllowed()
  @ApiOperation({ summary: 'Delete an announcement (admin / HR)' })
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentOrg() orgId: string) {
    return this.announcementsService.delete(id, orgId);
  }
}
