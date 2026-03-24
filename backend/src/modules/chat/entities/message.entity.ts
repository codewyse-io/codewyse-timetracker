import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from '../../users/entities/user.entity';

@Entity('messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column()
  senderId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'enum', enum: ['text', 'file', 'system'], default: 'text' })
  type: 'text' | 'file' | 'system';

  @Column({ type: 'text' })
  content: string;

  // File attachment fields (nullable for text/system messages)
  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  // Self-referencing for reply threads
  @Column({ type: 'varchar', nullable: true })
  replyToId: string | null;

  @ManyToOne(() => Message, { nullable: true })
  @JoinColumn({ name: 'replyToId' })
  replyTo: Message | null;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
