import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ConversationParticipant } from './conversation-participant.entity';
import { Message } from './message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['direct', 'group'], default: 'direct' })
  type: 'direct' | 'group';

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @OneToMany(() => ConversationParticipant, (p) => p.conversation, { cascade: true })
  participants: ConversationParticipant[];

  @OneToMany(() => Message, (m) => m.conversation)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
