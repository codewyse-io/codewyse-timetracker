import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrganizationsService } from './organizations.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Organization } from './entities/organization.entity';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class SuperAdminController {
  constructor(
    private readonly orgService: OrganizationsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  @Get('dashboard')
  async getDashboard() {
    const orgs = await this.orgService.findAll();

    const totalUsers = await this.userRepo.count();
    const activeUsers = await this.userRepo.count({ where: { status: 'active' as any } });

    const orgStats = await Promise.all(
      orgs.map(async (org) => {
        const stats = await this.orgService.getOrgStats(org.id);
        return { ...org, ...stats };
      }),
    );

    return {
      totalOrganizations: orgs.length,
      totalUsers,
      activeUsers,
      organizations: orgStats,
    };
  }
}
