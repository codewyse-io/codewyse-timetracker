import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCategoryRule, MatchType } from './entities/app-category-rule.entity';
import { AppCategory } from '../time-tracking/enums/app-category.enum';

@Injectable()
export class AppCategoriesService {
  private readonly logger = new Logger(AppCategoriesService.name);
  private rulesCache: AppCategoryRule[] = [];
  private cacheTimestamp = 0;
  private readonly cacheTtl = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(AppCategoryRule)
    private readonly ruleRepo: Repository<AppCategoryRule>,
  ) {}

  private async loadRules(): Promise<AppCategoryRule[]> {
    const now = Date.now();
    if (this.rulesCache.length > 0 && now - this.cacheTimestamp < this.cacheTtl) {
      return this.rulesCache;
    }
    this.rulesCache = await this.ruleRepo.find();
    this.cacheTimestamp = now;
    return this.rulesCache;
  }

  /** Invalidate the in-memory cache (call after CRUD operations) */
  invalidateCache(): void {
    this.cacheTimestamp = 0;
  }

  /**
   * Resolve the category for an app + windowInfo combo.
   * Resolution priority: designation-specific → shift-specific → global → NEUTRAL
   */
  async resolveCategory(
    appName: string,
    windowInfo: string,
    designation?: string | null,
    shiftId?: string | null,
  ): Promise<AppCategory> {
    const rules = await this.loadRules();
    const lowerApp = appName.toLowerCase();
    const lowerWindow = windowInfo.toLowerCase();

    let bestMatch: AppCategoryRule | null = null;
    let bestPriority = -1;

    for (const rule of rules) {
      const identifier = rule.appIdentifier.toLowerCase();

      // Check if rule matches
      let matches = false;
      switch (rule.matchType) {
        case MatchType.EXACT:
          matches = lowerApp === identifier || lowerWindow === identifier;
          break;
        case MatchType.CONTAINS:
          matches = lowerApp.includes(identifier) || lowerWindow.includes(identifier);
          break;
        case MatchType.DOMAIN:
          matches = lowerWindow === identifier || lowerWindow.endsWith('.' + identifier);
          break;
      }

      if (!matches) continue;

      // Calculate priority: more specific = higher priority
      let priority = 0;
      if (rule.designation && rule.designation.toLowerCase() === designation?.toLowerCase()) {
        priority += 10; // designation-specific match
      } else if (rule.designation) {
        continue; // skip — this rule is for a different designation
      }

      if (rule.shiftId && rule.shiftId === shiftId) {
        priority += 5; // shift-specific match
      } else if (rule.shiftId) {
        continue; // skip — this rule is for a different shift
      }

      // Exact match is more specific than contains
      if (rule.matchType === MatchType.EXACT) priority += 2;
      if (rule.matchType === MatchType.DOMAIN) priority += 1;

      if (priority > bestPriority) {
        bestPriority = priority;
        bestMatch = rule;
      }
    }

    return bestMatch?.category ?? AppCategory.NEUTRAL;
  }

  // ── CRUD for admin panel ──

  async findAll(shiftId?: string, designation?: string): Promise<AppCategoryRule[]> {
    const qb = this.ruleRepo.createQueryBuilder('r');
    if (shiftId) qb.andWhere('r.shift_id = :shiftId', { shiftId });
    if (designation) qb.andWhere('r.designation = :designation', { designation });
    return qb.orderBy('r.app_identifier', 'ASC').getMany();
  }

  async create(data: Partial<AppCategoryRule>): Promise<AppCategoryRule> {
    const rule = this.ruleRepo.create(data);
    const saved = await this.ruleRepo.save(rule);
    this.invalidateCache();
    return saved;
  }

  async update(id: string, data: Partial<AppCategoryRule>): Promise<AppCategoryRule> {
    await this.ruleRepo.update(id, data);
    this.invalidateCache();
    return this.ruleRepo.findOneOrFail({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.ruleRepo.delete(id);
    this.invalidateCache();
  }
}
