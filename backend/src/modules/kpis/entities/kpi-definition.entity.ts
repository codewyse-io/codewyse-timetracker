import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('kpi_definitions')
export class KpiDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  designation: string;

  @Column({ name: 'metric_name', type: 'varchar', length: 255 })
  metricName: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  unit: string; // 'percentage' | 'count' | 'hours' | 'score'

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
