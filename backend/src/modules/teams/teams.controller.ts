import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { AssignMembersDto, CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  // ── Admin ──
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all teams in the organization' })
  list(@CurrentOrg() orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new team' })
  create(@CurrentOrg() orgId: string, @Body() dto: CreateTeamDto) {
    return this.service.create(orgId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a team' })
  update(
    @CurrentOrg() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.service.update(id, orgId, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a team (members are unassigned)' })
  remove(@CurrentOrg() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id, orgId);
  }

  @Put(':id/members')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Replace the team membership' })
  assign(
    @CurrentOrg() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignMembersDto,
  ) {
    return this.service.assignMembers(id, orgId, dto);
  }

  // ── Employee ──
  @Get('me')
  @ApiOperation({ summary: 'Get the current user\'s teams and combined teammates' })
  myTeams(@Req() req: any) {
    return this.service.getMyTeams(req.user.id);
  }

  // ── Admin: per-user team membership ──
  @Get('users/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List the team IDs a user belongs to' })
  getUserTeams(
    @CurrentOrg() orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.getUserTeamIds(userId, orgId);
  }

  @Put('users/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Replace the list of teams a user belongs to' })
  setUserTeams(
    @CurrentOrg() orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { teamIds: string[] },
  ) {
    return this.service.setUserTeams(userId, orgId, body.teamIds || []);
  }
}
