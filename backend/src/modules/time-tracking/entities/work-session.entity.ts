import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { SessionStatus } from '../enums/session-status.enum';
import { IdleInterval } from './idle-interval.entity';
import { User } from '../../users/entities/user.entity';

@Entity('work_sessions')
export class WorkSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime: Date | null;

  @Column({ name: 'total_duration', type: 'int', default: 0 })
  totalDuration: number; // seconds

  @Column({ name: 'idle_duration', type: 'int', default: 0 })
  idleDuration: number; // seconds

  @Column({ name: 'active_duration', type: 'int', default: 0 })
  activeDuration: number; // seconds

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  status: SessionStatus;

  @Column({ type: 'varchar', length: 20, default: 'regular' })
  mode: string; // 'regular' | 'overtime'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => IdleInterval, (idle) => idle.session, { cascade: true })
  idleIntervals: IdleInterval[];
}
