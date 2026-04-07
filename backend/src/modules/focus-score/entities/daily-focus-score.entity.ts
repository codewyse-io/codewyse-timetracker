import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { FocusCategory } from '../enums/focus-category.enum';

@Entity('daily_focus_scores')
@Unique(['userId', 'date'])
export class DailyFocusScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'enum', enum: FocusCategory, default: FocusCategory.LOW_FOCUS })
  category: FocusCategory;

  @Column({ name: 'total_active_time', type: 'int', default: 0 })
  totalActiveTime: number; // seconds

  @Column({ name: 'total_logged_time', type: 'int', default: 0 })
  totalLoggedTime: number; // seconds

  @Column({ name: 'idle_interruptions', type: 'int', default: 0 })
  idleInterruptions: number;

  @Column({ name: 'productive_time', type: 'int', default: 0 })
  productiveTime: number; // seconds

  @Column({ name: 'unproductive_time', type: 'int', default: 0 })
  unproductiveTime: number; // seconds

  @Column({ name: 'neutral_time', type: 'int', default: 0 })
  neutralTime: number; // seconds

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'organization_id', type: 'varchar', length: 36 })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
