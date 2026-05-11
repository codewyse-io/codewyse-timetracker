import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team } from './entities/team.entity';
import { User } from '../users/entities/user.entity';
import { AssignMembersDto, CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teamRepo: Repository<Team>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async list(organizationId: string) {
    const teams = await this.teamRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
    const ids = teams.map((t) => t.id);
    if (ids.length === 0) return [];

    const members = await this.userRepo.find({
      where: { teamId: In(ids), organizationId },
      select: ['id', 'firstName', 'lastName', 'email', 'designation', 'teamId'],
    });
    const byTeam = new Map<string, typeof members>();
    for (const m of members) {
      const arr = byTeam.get(m.teamId!) || [];
      arr.push(m);
      byTeam.set(m.teamId!, arr);
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
    // Unassign members first
    await this.userRepo.update(
      { teamId: team.id, organizationId },
      { teamId: null },
    );
    await this.teamRepo.remove(team);
    return { deleted: true };
  }

  async assignMembers(
    teamId: string,
    organizationId: string,
    dto: AssignMembersDto,
  ) {
    const team = await this.findOwned(teamId, organizationId);

    if (dto.memberIds.length > 0) {
      const valid = await this.userRepo.find({
        where: { id: In(dto.memberIds), organizationId },
        select: ['id'],
      });
      if (valid.length !== dto.memberIds.length) {
        throw new BadRequestException(
          'Some users do not belong to this organization.',
        );
      }
    }

    // Replace team membership: unassign anyone currently in this team
    // who is not in the new list, then assign the new list.
    await this.userRepo.update(
      { teamId: team.id, organizationId },
      { teamId: null },
    );
    if (dto.memberIds.length > 0) {
      await this.userRepo.update(
        { id: In(dto.memberIds), organizationId },
        { teamId: team.id },
      );
    }

    return this.list(organizationId);
  }

  /**
   * For employee — get their team and teammates (active members).
   * Returns null if the user has no team.
   */
  async getMyTeam(userId: string) {
    const me = await this.userRepo.findOne({ where: { id: userId } });
    if (!me || !me.teamId || !me.organizationId) return null;

    const team = await this.teamRepo.findOne({ where: { id: me.teamId } });
    if (!team) return null;

    const members = await this.userRepo.find({
      where: { teamId: team.id, organizationId: me.organizationId },
      select: ['id', 'firstName', 'lastName', 'email', 'designation', 'status'],
    });
    return { team, members };
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
