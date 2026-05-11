import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { User } from '../users/entities/user.entity';
import { AssignMembersDto, CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teamRepo: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly membershipRepo: Repository<TeamMember>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async list(organizationId: string) {
    const teams = await this.teamRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
    if (teams.length === 0) return [];

    const memberships = await this.membershipRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.user', 'user')
      .where('m.team_id IN (:...ids)', { ids: teams.map((t) => t.id) })
      .getMany();

    const byTeam = new Map<string, Array<{ id: string; firstName: string; lastName: string; email: string; designation: string | null }>>();
    for (const m of memberships) {
      const arr = byTeam.get(m.teamId) || [];
      if (m.user) {
        arr.push({
          id: m.user.id,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          designation: m.user.designation || null,
        });
      }
      byTeam.set(m.teamId, arr);
    }

    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      createdAt: t.createdAt,
      memberCount: byTeam.get(t.id)?.length || 0,
      members: byTeam.get(t.id) || [],
    }));
  }

  async create(organizationId: string, dto: CreateTeamDto) {
    const existing = await this.teamRepo.findOne({
      where: { organizationId, name: dto.name.trim() },
    });
    if (existing) {
      throw new BadRequestException('A team with this name already exists.');
    }
    const team = await this.teamRepo.save(
      this.teamRepo.create({
        organizationId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
      }),
    );
    if (dto.memberIds?.length) {
      await this.assignMembers(team.id, organizationId, {
        memberIds: dto.memberIds,
      });
    }
    return team;
  }

  async update(teamId: string, organizationId: string, dto: UpdateTeamDto) {
    const team = await this.findOwned(teamId, organizationId);
    if (dto.name !== undefined) team.name = dto.name.trim();
    if (dto.description !== undefined) {
      team.description = dto.description?.trim() || null;
    }
    return this.teamRepo.save(team);
  }

  async remove(teamId: string, organizationId: string) {
    const team = await this.findOwned(teamId, organizationId);
    // FK on team_members(team_id) is ON DELETE CASCADE, so the join rows go too.
    await this.teamRepo.remove(team);
    return { deleted: true };
  }

  /**
   * Replace the team's membership list. Users not in the new list are
   * removed FROM THIS TEAM ONLY — their memberships in other teams are
   * left intact (multi-team support).
   */
  async assignMembers(
    teamId: string,
    organizationId: string,
    dto: AssignMembersDto,
  ) {
    const team = await this.findOwned(teamId, organizationId);

    const incoming = Array.from(new Set(dto.memberIds));

    if (incoming.length > 0) {
      const valid = await this.userRepo.find({
        where: { id: In(incoming), organizationId },
        select: ['id'],
      });
      if (valid.length !== incoming.length) {
        throw new BadRequestException(
          'Some users do not belong to this organization.',
        );
      }
    }

    const current = await this.membershipRepo.find({
      where: { teamId: team.id },
    });
    const currentIds = new Set(current.map((m) => m.userId));
    const incomingSet = new Set(incoming);

    const toRemove = current.filter((m) => !incomingSet.has(m.userId));
    const toAdd = incoming.filter((id) => !currentIds.has(id));

    if (toRemove.length > 0) {
      await this.membershipRepo.remove(toRemove);
    }
    if (toAdd.length > 0) {
      const fresh = toAdd.map((userId) =>
        this.membershipRepo.create({ teamId: team.id, userId }),
      );
      await this.membershipRepo.save(fresh);
    }

    return this.list(organizationId);
  }

  /**
   * For employee — get all teams + teammates the user belongs to (active members).
   * Returns null if the user has no team memberships.
   */
  async getMyTeams(userId: string) {
    const me = await this.userRepo.findOne({ where: { id: userId } });
    if (!me || !me.organizationId) return null;

    const myMemberships = await this.membershipRepo.find({
      where: { userId: me.id },
    });
    const myTeamIds = myMemberships.map((m) => m.teamId);
    if (myTeamIds.length === 0) return { teams: [], teammates: [] };

    const teams = await this.teamRepo.find({
      where: { id: In(myTeamIds), organizationId: me.organizationId },
    });

    const teammateMemberships = await this.membershipRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.user', 'user')
      .where('m.team_id IN (:...ids)', { ids: myTeamIds })
      .andWhere('m.user_id != :uid', { uid: me.id })
      .getMany();

    const byUserId = new Map<string, { user: User; teamIds: Set<string> }>();
    for (const m of teammateMemberships) {
      if (!m.user) continue;
      const entry = byUserId.get(m.userId) || { user: m.user, teamIds: new Set() };
      entry.teamIds.add(m.teamId);
      byUserId.set(m.userId, entry);
    }

    return {
      teams,
      teammates: Array.from(byUserId.values()).map(({ user, teamIds }) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        designation: user.designation || null,
        teamIds: Array.from(teamIds),
      })),
    };
  }

  /**
   * Returns set of user IDs that share at least one team with `userId`
   * within the same organization. Self is excluded.
   */
  async getTeammateIds(userId: string, organizationId: string): Promise<Set<string>> {
    const myMemberships = await this.membershipRepo.find({
      where: { userId },
    });
    const myTeamIds = myMemberships.map((m) => m.teamId);
    if (myTeamIds.length === 0) return new Set();

    const teammates = await this.membershipRepo
      .createQueryBuilder('m')
      .select('DISTINCT m.user_id', 'userId')
      .innerJoin('users', 'u', 'u.id = m.user_id')
      .where('m.team_id IN (:...ids)', { ids: myTeamIds })
      .andWhere('m.user_id != :uid', { uid: userId })
      .andWhere('u.organization_id = :org', { org: organizationId })
      .getRawMany<{ userId: string }>();

    return new Set(teammates.map((t) => t.userId));
  }

  async shareTeam(
    userIdA: string,
    userIdB: string,
    organizationId: string,
  ): Promise<boolean> {
    const teammates = await this.getTeammateIds(userIdA, organizationId);
    return teammates.has(userIdB);
  }

  /**
   * Get the team IDs a user currently belongs to (org-scoped).
   */
  async getUserTeamIds(userId: string, organizationId: string): Promise<string[]> {
    const memberships = await this.membershipRepo
      .createQueryBuilder('m')
      .innerJoin('teams', 't', 't.id = m.team_id')
      .select('m.team_id', 'teamId')
      .where('m.user_id = :uid', { uid: userId })
      .andWhere('t.organization_id = :org', { org: organizationId })
      .getRawMany<{ teamId: string }>();
    return memberships.map((r) => r.teamId);
  }

  /**
   * Set the list of teams a user belongs to. Replaces existing memberships
   * for THIS user within the org (any teams not in the new list are removed).
   */
  async setUserTeams(
    userId: string,
    organizationId: string,
    teamIds: string[],
  ): Promise<string[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    if (user.organizationId !== organizationId) {
      throw new ForbiddenException();
    }

    const wanted = Array.from(new Set(teamIds));
    if (wanted.length > 0) {
      const validTeams = await this.teamRepo.find({
        where: { id: In(wanted), organizationId },
        select: ['id'],
      });
      if (validTeams.length !== wanted.length) {
        throw new BadRequestException(
          'Some teams do not exist in this organization.',
        );
      }
    }

    const current = await this.membershipRepo.find({ where: { userId } });
    // Restrict to org's teams (defensive)
    const currentInOrg = await this.teamRepo.find({
      where: { id: In(current.map((m) => m.teamId).length ? current.map((m) => m.teamId) : ['']), organizationId },
      select: ['id'],
    });
    const orgTeamIds = new Set(currentInOrg.map((t) => t.id));
    const currentOrgMemberships = current.filter((m) => orgTeamIds.has(m.teamId));

    const currentIds = new Set(currentOrgMemberships.map((m) => m.teamId));
    const wantedSet = new Set(wanted);

    const toRemove = currentOrgMemberships.filter((m) => !wantedSet.has(m.teamId));
    const toAdd = wanted.filter((id) => !currentIds.has(id));

    if (toRemove.length > 0) {
      await this.membershipRepo.remove(toRemove);
    }
    if (toAdd.length > 0) {
      await this.membershipRepo.save(
        toAdd.map((teamId) => this.membershipRepo.create({ teamId, userId })),
      );
    }

    return this.getUserTeamIds(userId, organizationId);
  }

  private async findOwned(teamId: string, organizationId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found.');
    if (team.organizationId !== organizationId) {
      throw new ForbiddenException();
    }
    return team;
  }
}
