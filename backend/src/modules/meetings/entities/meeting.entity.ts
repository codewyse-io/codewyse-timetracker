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

export enum MeetingStatus {
  SCHEDULED = 'scheduled',
  BOT_JOINING = 'bot_joining',
  BOT_IN_MEETING = 'bot_in_meeting',
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum MeetingPlatform {
  ZOOM = 'zoom',
  GOOGLE_MEET = 'google_meet',
  MICROSOFT_TEAMS = 'microsoft_teams',
  TEAMS = 'teams',
  OTHER = 'other',
  UNKNOWN = 'unknown',
}

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ name: 'meeting_url' })
  meetingUrl: string;

  @Column({ type: 'enum', enum: MeetingPlatform, default: MeetingPlatform.UNKNOWN })
  platform: MeetingPlatform;

  @Column({ type: 'enum', enum: MeetingStatus, default: MeetingStatus.SCHEDULED })
  status: MeetingStatus;

  @Column({ name: 'recall_bot_id', nullable: true })
  recallBotId: string;

  @Column({ name: 'recording_s3_key', nullable: true })
  recordingKey: string;

  @Column({ name: 'transcript_text', type: 'longtext', nullable: true })
  transcript: string;

  @Column({ type: 'text', nullable: true })
  summary: string;

  @Column({ name: 'action_items', type: 'json', nullable: true })
  actionItems: { task: string; assignee?: string }[];

  @Column({ name: 'scheduled_start', type: 'datetime', nullable: true })
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'datetime', nullable: true })
  scheduledEnd: Date;

  @Column({ name: 'google_event_id', nullable: true })
  googleEventId: string;

  @Column({ name: 'duration_seconds', nullable: true })
  durationSeconds: number;

  @Column({ type: 'json', nullable: true })
  participants: string[];

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
