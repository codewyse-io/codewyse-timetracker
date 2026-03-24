import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('call_logs')
export class CallLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['audio', 'video'], default: 'audio' })
  type: 'audio' | 'video';

  @Column({
    type: 'enum',
    enum: ['ringing', 'connecting', 'connected', 'ended', 'missed', 'declined'],
    default: 'ringing',
  })
  state: 'ringing' | 'connecting' | 'connected' | 'ended' | 'missed' | 'declined';

  @Column()
  initiatorId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'initiatorId' })
  initiator: User;

  @Column({ type: 'simple-json' })
  participantIds: string[];

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  connectedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number | null;
}
