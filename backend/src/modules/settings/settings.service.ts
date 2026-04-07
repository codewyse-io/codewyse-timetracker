import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  async get(key: string, organizationId?: string): Promise<string | null> {
    const where: any = { key };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const setting = await this.settingRepo.findOne({ where });
    return setting?.value ?? null;
  }

  async set(key: string, value: string, description?: string, organizationId?: string): Promise<Setting> {
    const where: any = { key };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    let setting = await this.settingRepo.findOne({ where });

    if (setting) {
      setting.value = value;
      if (description !== undefined) {
        setting.description = description;
      }
    } else {
      setting = this.settingRepo.create({
        key,
        value,
        description: description ?? '',
        ...(organizationId ? { organizationId } : {}),
      });
    }

    return this.settingRepo.save(setting);
  }

  async getAll(organizationId?: string): Promise<Setting[]> {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    return this.settingRepo.find({ where, order: { key: 'ASC' } });
  }
}
