import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PeerReviewSurvey } from './peer-review-survey.entity';
import { PeerReviewAnswer } from './peer-review-answer.entity';

export enum PeerReviewResponseStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
}

export enum PeerReviewResponseKind {
  TEAM = 'team',
  HR = 'hr',
}

@Entity('peer_review_responses')
@Index(['surveyId', 'reviewerId', 'revieweeId', 'kind'], { unique: true })
export class PeerReviewResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'survey_id', type: 'varchar', length: 36 })
  surveyId: string;

  @ManyToOne(() => PeerReviewSurvey, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'survey_id' })
  survey: PeerReviewSurvey;

  @Column({ name: 'reviewer_id', type: 'varchar', length: 36 })
  reviewerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  @Column({ name: 'reviewee_id', type: 'varchar', length: 36 })
  revieweeId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewee_id' })
  reviewee: User;

  @Column({
    type: 'enum',
    enum: PeerReviewResponseStatus,
    default: PeerReviewResponseStatus.DRAFT,
  })
  status: PeerReviewResponseStatus;

  @Column({
    type: 'enum',
    enum: PeerReviewResponseKind,
    default: PeerReviewResponseKind.TEAM,
  })
  kind: PeerReviewResponseKind;

  @Column({ name: 'submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => PeerReviewAnswer, (a) => a.response, { cascade: true })
  answers: PeerReviewAnswer[];
}
