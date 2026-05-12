import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull, Or } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
  ) {}

  async create(dto: CreateAnnouncementDto, userId: string, organizationId: string): Promise<Announcement> {
    const announcement = this.repo.create({
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdBy: userId,
      organizationId,
    });
    return this.repo.save(announcement);
  }

  async findAll(organizationId: string): Promise<Announcement[]> {
    return this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async findActive(organizationId: string): Promise<Announcement[]> {
    const now = new Date();
    return this.repo.find({
      where: {
        isActive: true,
        organizationId,
        expiresAt: Or(IsNull(), MoreThanOrEqual(now)),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, organizationId?: string): Promise<Announcement> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    // Defensive: when an organizationId is provided, ensure the row belongs
    // to that org. Prevents an admin/HR in tenant A from mutating notices
    // in tenant B by guessing a UUID.
    if (organizationId && announcement.organizationId !== organizationId) {
      throw new ForbiddenException('Announcement does not belong to your organization');
    }
    return announcement;
  }

  async deactivate(id: string, organizationId?: string): Promise<Announcement> {
    const announcement = await this.findById(id, organizationId);
    announcement.isActive = false;
    return this.repo.save(announcement);
  }

  async delete(id: string, organizationId?: string): Promise<void> {
    const announcement = await this.findById(id, organizationId);
    await this.repo.remove(announcement);
  }
}
