import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum InsightType {
  PRODUCTIVITY = 'productivity',
  TIME_USAGE = 'time_usage',
  PATTERN = 'pattern',
  TEAM = 'team',
}

@Entity('ai_insights')
export class AiInsight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'enum', enum: InsightType })
  type: InsightType;

  @Column({ type: 'text' })
  insight: string;

  @Column({ type: 'text' })
  recommendation: string;

  @Column({ name: 'generated_at', type: 'datetime' })
  generatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
