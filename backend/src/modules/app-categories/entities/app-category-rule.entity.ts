import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { AppCategory } from '../../time-tracking/enums/app-category.enum';

export enum MatchType {
  EXACT = 'exact',
  CONTAINS = 'contains',
  DOMAIN = 'domain',
}

@Entity('app_category_rules')
export class AppCategoryRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'app_identifier', type: 'varchar', length: 255 })
  appIdentifier: string; // process name or domain, e.g. "chrome", "linkedin.com"

  @Column({ name: 'match_type', type: 'enum', enum: MatchType, default: MatchType.CONTAINS })
  matchType: MatchType;

  @Column({ type: 'enum', enum: AppCategory, default: AppCategory.NEUTRAL })
  category: AppCategory;

  @Column({ name: 'display_name', type: 'varchar', length: 100, default: '' })
  displayName: string; // human-readable name, e.g. "LinkedIn", "Microsoft Excel"

  @Column({ name: 'shift_id', type: 'varchar', length: 36, nullable: true })
  shiftId: string | null; // null = global, non-null = shift-specific override

  @Column({ type: 'varchar', length: 100, nullable: true })
  designation: string | null; // null = all roles, e.g. "Sales" = only for sales designation

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
