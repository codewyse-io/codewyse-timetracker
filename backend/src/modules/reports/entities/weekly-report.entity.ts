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

@Entity('weekly_reports')
@Unique(['userId', 'weekStart'])
export class WeeklyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ name: 'week_end', type: 'date' })
  weekEnd: string;

  @Column({ name: 'total_hours_worked', type: 'decimal', precision: 8, scale: 2, default: 0 })
  totalHoursWorked: number;

  @Column({ name: 'active_hours', type: 'decimal', precision: 8, scale: 2, default: 0 })
  activeHours: number;

  @Column({ name: 'idle_hours', type: 'decimal', precision: 8, scale: 2, default: 0 })
  idleHours: number;

  @Column({ name: 'focus_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  focusScore: number;

  @Column({ name: 'kpi_summary', type: 'text', nullable: true })
  kpiSummary: string; // JSON string

  @Column({ name: 'payable_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  payableAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
