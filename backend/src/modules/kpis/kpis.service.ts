import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiDefinition } from './entities/kpi-definition.entity';
import { KpiEntry, KpiPeriod } from './entities/kpi-entry.entity';
import { CreateKpiEntryDto } from './dto/create-kpi-entry.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class KpisService {
  constructor(
    @InjectRepository(KpiDefinition)
    private readonly kpiDefRepo: Repository<KpiDefinition>,
    @InjectRepository(KpiEntry)
    private readonly kpiEntryRepo: Repository<KpiEntry>,
  ) {}

  async getDefinitions(organizationId: string, designation?: string): Promise<KpiDefinition[]> {
    const query = this.kpiDefRepo.createQueryBuilder('kd')
      .where('kd.isActive = :active', { active: true })
      .andWhere('kd.organizationId = :organizationId', { organizationId });

    if (designation) {
      query.andWhere('kd.designation = :designation', { designation });
    }

    return query.orderBy('kd.designation', 'ASC').addOrderBy('kd.metricName', 'ASC').getMany();
  }

  async createEntry(dto: CreateKpiEntryDto, organizationId?: string): Promise<KpiEntry> {
    const definition = await this.kpiDefRepo.findOne({
      where: { id: dto.kpiDefinitionId },
    });

    if (!definition) {
      throw new NotFoundException('KPI definition not found');
    }

    const entry = this.kpiEntryRepo.create({ ...dto, ...(organizationId ? { organizationId } : {}) });
    return this.kpiEntryRepo.save(entry);
  }

  async bulkCreateEntries(entries: CreateKpiEntryDto[], organizationId?: string): Promise<KpiEntry[]> {
    const data = organizationId
      ? entries.map((e) => ({ ...e, organizationId }))
      : entries;
    const created = this.kpiEntryRepo.create(data);
    return this.kpiEntryRepo.save(created);
  }

  async getEmployeeKpis(
    userId: string,
    period?: KpiPeriod,
    periodStart?: string,
  ): Promise<KpiEntry[]> {
    const query = this.kpiEntryRepo.createQueryBuilder('ke')
      .leftJoinAndSelect('ke.kpiDefinition', 'kd')
      .where('ke.userId = :userId', { userId });

    if (period) {
      query.andWhere('ke.period = :period', { period });
    }

    if (periodStart) {
      query.andWhere('ke.periodStart = :periodStart', { periodStart });
    }

    return query.orderBy('ke.createdAt', 'DESC').getMany();
  }

  async getTeamKpis(
    organizationId: string,
    period: KpiPeriod,
    periodStart: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponseDto<KpiEntry>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.kpiEntryRepo.createQueryBuilder('ke')
      .leftJoinAndSelect('ke.kpiDefinition', 'kd')
      .leftJoinAndSelect('ke.user', 'user')
      .where('ke.organizationId = :organizationId', { organizationId })
      .andWhere('ke.period = :period', { period })
      .andWhere('ke.periodStart = :periodStart', { periodStart })
      .orderBy('user.firstName', 'ASC')
      .addOrderBy('kd.metricName', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
