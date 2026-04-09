import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('google_calendar_connections')
export class GoogleCalendarConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, unique: true })
  userId: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36 })
  organizationId: string;

  @Column({ name: 'google_email', type: 'varchar', length: 255 })
  googleEmail: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'token_expiry', type: 'datetime' })
  tokenExpiry: Date;

  @Column({ name: 'calendar_sync_enabled', type: 'tinyint', default: 1 })
  calendarSyncEnabled: boolean;

  @Column({ name: 'last_sync_at', type: 'datetime', nullable: true })
  lastSyncAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
