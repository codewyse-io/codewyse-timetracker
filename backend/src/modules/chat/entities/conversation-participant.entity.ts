import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from '../../users/entities/user.entity';

@Entity('conversation_participants')
@Unique(['conversationId', 'userId'])
export class ConversationParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column()
  userId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: ['owner', 'member'], default: 'member' })
  role: 'owner' | 'member';

  @Column({ type: 'varchar', nullable: true })
  lastReadMessageId: string | null;

  @Column({ type: 'datetime', nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn()
  joinedAt: Date;
}
