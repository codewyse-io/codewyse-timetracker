import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum PeerReviewSurveyStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('peer_review_surveys')
@Index(['organizationId', 'periodMonth'], { unique: true })
export class PeerReviewSurvey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'varchar', length: 36 })
  organizationId: string;

  // YYYY-MM of the month being reviewed
  @Column({ name: 'period_month', type: 'varchar', length: 7 })
  periodMonth: string;

  @Column({ name: 'opens_at', type: 'datetime' })
  opensAt: Date;

  @Column({ name: 'closes_at', type: 'datetime' })
  closesAt: Date;

  @Column({
    type: 'enum',
    enum: PeerReviewSurveyStatus,
    default: PeerReviewSurveyStatus.OPEN,
  })
  status: PeerReviewSurveyStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
