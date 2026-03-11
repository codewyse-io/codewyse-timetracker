import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkSession } from './work-session.entity';

@Entity('idle_intervals')
export class IdleInterval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  endTime: Date;

  @Column({ type: 'int' })
  duration: number; // seconds

  @ManyToOne(() => WorkSession, (session) => session.idleIntervals, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: WorkSession;
}
