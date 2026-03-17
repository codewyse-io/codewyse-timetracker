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

export enum AnnouncementType {
  GENERAL = 'general',
  HOLIDAY = 'holiday',
  MEETING = 'meeting',
  MEMO = 'memo',
  URGENT = 'urgent',
}

export enum AnnouncementPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: AnnouncementType, default: AnnouncementType.GENERAL })
  type: AnnouncementType;

  @Column({ type: 'enum', enum: AnnouncementPriority, default: AnnouncementPriority.NORMAL })
  priority: AnnouncementPriority;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'created_by' })
  author: User;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
