import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum CoachingCategory {
  PRODUCTIVITY = 'productivity',
  TIME_USAGE = 'time_usage',
  WORKLOAD = 'workload',
}

@Entity('ai_coaching_tips')
export class AiCoachingTip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'enum', enum: CoachingCategory })
  category: CoachingCategory;

  @Column({ type: 'text' })
  observation: string;

  @Column({ type: 'text' })
  recommendation: string;

  @Column({ name: 'generated_at', type: 'datetime' })
  generatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
