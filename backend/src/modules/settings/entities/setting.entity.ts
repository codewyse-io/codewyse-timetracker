import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 1000 })
  value: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  description: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36 })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
