import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { KpiDefinition } from './kpi-definition.entity';

export enum KpiPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('kpi_entries')
export class KpiEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'kpi_definition_id', type: 'varchar', length: 36 })
  kpiDefinitionId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ type: 'enum', enum: KpiPeriod })
  period: KpiPeriod;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => KpiDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kpi_definition_id' })
  kpiDefinition: KpiDefinition;
}
