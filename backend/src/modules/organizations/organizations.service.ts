import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { User } from '../users/entities/user.entity';
import { WorkSession } from '../time-tracking/entities/work-session.entity';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WorkSession)
    private readonly sessionRepo: Repository<WorkSession>,
    private readonly s3Service: S3Service,
  ) {}

  async findById(id: string): Promise<Organization> {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    await this.orgRepo.update(id, data);
    return this.findById(id);
  }

  /** Return org with logoUrl resolved to a presigned S3 URL */
  async getWithResolvedLogo(id: string): Promise<Organization & { logoUrl: string | null }> {
    const org = await this.findById(id);
    if (org.logoUrl) {
      try {
        (org as any).logoUrl = await this.s3Service.getPresignedUrl(org.logoUrl);
      } catch {
        // keep raw key as fallback
      }
    }
    return org;
  }

  async uploadLogo(id: string, file: Express.Multer.File): Promise<Organization> {
    const key = await this.s3Service.uploadFile(file, `organizations/${id}`);
    await this.orgRepo.update(id, { logoUrl: key }); // store key, resolve URL on read
    return this.getWithResolvedLogo(id);
  }

  // ── Super admin methods ──

  async findAll(): Promise<Organization[]> {
    return this.orgRepo.find({ order: { createdAt: 'DESC' } });
  }

  async create(data: { name: string; slug: string; emailFromName?: string; primaryColor?: string }): Promise<Organization> {
    const exists = await this.orgRepo.findOne({ where: { slug: data.slug } });
    if (exists) throw new ConflictException('Organization with this slug already exists');
    const org = this.orgRepo.create(data);
    return this.orgRepo.save(org);
  }

  async remove(id: string): Promise<void> {
    const userCount = await this.userRepo.count({ where: { organizationId: id } });
    if (userCount > 0) throw new ConflictException(`Cannot delete organization with ${userCount} users. Reassign or delete users first.`);
    await this.orgRepo.delete(id);
  }

  async getOrgStats(id: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    activeSessions: number;
    totalSessionsThisMonth: number;
  }> {
    const totalUsers = await this.userRepo.count({ where: { organizationId: id } });
    const activeUsers = await this.userRepo.count({ where: { organizationId: id, status: 'active' as any } });
    const activeSessions = await this.sessionRepo.count({ where: { organizationId: id, status: 'active' as any } });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const totalSessionsThisMonth = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.organizationId = :orgId', { orgId: id })
      .andWhere('s.startTime >= :monthStart', { monthStart })
      .getCount();

    return { totalUsers, activeUsers, activeSessions, totalSessionsThisMonth };
  }

  async getBranding(id: string): Promise<{
    appName: string;
    logoUrl: string | null;
    primaryColor: string;
    emailFromName: string;
  }> {
    const org = await this.findById(id);
    let logoUrl: string | null = null;
    if (org.logoUrl) {
      try {
        logoUrl = await this.s3Service.getPresignedUrl(org.logoUrl);
      } catch {}
    }
    return {
      appName: org.name,
      logoUrl,
      primaryColor: org.primaryColor,
      emailFromName: org.emailFromName,
    };
  }
}
