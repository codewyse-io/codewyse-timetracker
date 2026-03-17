import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(dto: CreateAnnouncementDto, userId: string): Promise<Announcement> {
    const announcement = this.repo.create({
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdBy: userId,
    });
    return this.repo.save(announcement);
  }

  async findAll(): Promise<Announcement[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findActive(): Promise<Announcement[]> {
    const now = new Date();
    return this.repo.find({
      where: {
        isActive: true,
        expiresAt: Or(IsNull(), MoreThanOrEqual(now)),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Announcement> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  async deactivate(id: string): Promise<Announcement> {
    const announcement = await this.findById(id);
    announcement.isActive = false;
    return this.repo.save(announcement);
  }

  async delete(id: string): Promise<void> {
    const announcement = await this.findById(id);
    await this.repo.remove(announcement);
  }
}
