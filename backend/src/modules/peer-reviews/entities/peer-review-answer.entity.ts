import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PeerReviewResponse } from './peer-review-response.entity';
import { PeerReviewCategory } from '../peer-review-questions';

@Entity('peer_review_answers')
@Index(['responseId', 'questionKey'], { unique: true })
export class PeerReviewAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'response_id', type: 'varchar', length: 36 })
  responseId: string;

  @ManyToOne(() => PeerReviewResponse, (r) => r.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'response_id' })
  response: PeerReviewResponse;

  @Column({ name: 'question_key', type: 'varchar', length: 64 })
  questionKey: string;

  @Column({ type: 'enum', enum: PeerReviewCategory })
  category: PeerReviewCategory;

  // 1..5 Likert score
  @Column({ type: 'tinyint' })
  score: number;
}
