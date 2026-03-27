import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkSession } from './work-session.entity';
import { AppCategory } from '../enums/app-category.enum';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ name: 'app_name', type: 'varchar', length: 255 })
  appName: string;

  @Column({ name: 'window_info', type: 'varchar', length: 255, default: '' })
  windowInfo: string; // domain for browsers, app name for others

  @Column({
    type: 'enum',
    enum: AppCategory,
    default: AppCategory.NEUTRAL,
  })
  category: AppCategory;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt: Date;

  @Column({ name: 'duration_seconds', type: 'int' })
  durationSeconds: number;

  @ManyToOne(() => WorkSession, (session) => session.activityLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: WorkSession;
}
