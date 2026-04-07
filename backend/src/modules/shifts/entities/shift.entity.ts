import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'start_time', length: 5 })
  startTime: string; // "HH:mm" format

  @Column({ name: 'end_time', length: 5 })
  endTime: string; // "HH:mm" format

  @Column({ name: 'allowed_days', type: 'simple-array' })
  allowedDays: string[]; // e.g. ["monday","tuesday","wednesday","thursday","friday"]

  @Column({ length: 64, default: 'UTC' })
  timezone: string; // IANA timezone, e.g. "America/New_York"

  @Column({ name: 'idle_threshold_minutes', type: 'int', default: 3 })
  idleThresholdMinutes: number; // minutes of inactivity before marking as idle

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'organization_id', type: 'varchar', length: 36 })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
