import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, Like } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Message } from './entities/message.entity';
import { S3Service } from '../s3/s3.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepo: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly s3Service: S3Service,
  ) {}

  /** Generate a fresh presigned URL for a file message's S3 key */
  async resolveFileUrl(message: Message): Promise<string | null> {
    if (message.type !== 'file' || !message.fileUrl) return message.fileUrl;
    try {
      return await this.s3Service.getPresignedUrl(message.fileUrl, 3600);
    } catch {
      return message.fileUrl; // Fallback to stored value
    }
  }

  /** Resolve presigned URLs for an array of messages */
  async resolveFileUrls(messages: Message[]): Promise<Message[]> {
    for (const msg of messages) {
      if (msg.type === 'file' && msg.fileUrl) {
        try {
          (msg as any).fileUrl = await this.s3Service.getPresignedUrl(msg.fileUrl, 3600);
        } catch {
          // Keep original key as fallback
        }
      }
    }
    return messages;
  }

  // ── Conversations ──

  async createConversation(
    creatorId: string,
    type: 'direct' | 'group',
    participantIds: string[],
    name?: string,
  ): Promise<Conversation> {
    // For direct conversations, check if one already exists between these two users
    if (type === 'direct') {
      if (participantIds.length !== 1) {
        throw new BadRequestException('Direct conversations require exactly one other participant');
      }
      const otherId = participantIds[0];
      const existing = await this.findDirectConversation(creatorId, otherId);
      if (existing) return existing;
    }

    const conversation = this.conversationRepo.create({
      type,
      name: type === 'group' ? (name || 'Group Chat') : null,
    });
    const saved = await this.conversationRepo.save(conversation);

    // Add creator as owner + other participants as members
    const allIds = [creatorId, ...participantIds.filter((id) => id !== creatorId)];
    const participants = allIds.map((userId) =>
      this.participantRepo.create({
        conversationId: saved.id,
        userId,
        role: userId === creatorId ? 'owner' : 'member',
      }),
    );
    await this.participantRepo.save(participants);

    // If it's a group, send a system message
    if (type === 'group') {
      const systemMsg = this.messageRepo.create({
        conversationId: saved.id,
        senderId: creatorId,
        type: 'system',
        content: 'Group created',
      });
      await this.messageRepo.save(systemMsg);
    }

    return this.getConversationById(saved.id);
  }

  private async findDirectConversation(userId1: string, userId2: string): Promise<Conversation | null> {
    // Find conversations where both users are participants and type is direct
    const result = await this.conversationRepo
      .createQueryBuilder('c')
      .innerJoin('c.participants', 'p1', 'p1.userId = :userId1', { userId1 })
      .innerJoin('c.participants', 'p2', 'p2.userId = :userId2', { userId2 })
      .where('c.type = :type', { type: 'direct' })
      .getOne();

    if (!result) return null;
    return this.getConversationById(result.id);
  }

  async getConversationById(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
      relations: ['participants', 'participants.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getUserConversations(userId: string): Promise<any[]> {
    // Get all conversation IDs the user is part of
    const participations = await this.participantRepo.find({
      where: { userId },
      select: ['conversationId', 'lastReadMessageId'],
    });

    if (participations.length === 0) return [];

    const conversationIds = participations.map((p) => p.conversationId);
    const lastReadMap = new Map(participations.map((p) => [p.conversationId, p.lastReadMessageId]));

    // Load conversations with participants in a single query (Fix N+1)
    const conversations = await this.conversationRepo.find({
      where: { id: In(conversationIds) },
      relations: ['participants', 'participants.user'],
      order: { updatedAt: 'DESC' },
    });

    // Batch query: get last message per conversation using a subquery (works on both PostgreSQL and MySQL)
    const lastMessages = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .innerJoin(
        (qb) =>
          qb
            .select('sub.conversationId', 'conversationId')
            .addSelect('MAX(sub.createdAt)', 'maxDate')
            .from(Message, 'sub')
            .where('sub.conversationId IN (:...convIds)', { convIds: conversationIds })
            .andWhere('sub.isDeleted = false')
            .groupBy('sub.conversationId'),
        'latest',
        'm.conversationId = latest.conversationId AND m.createdAt = latest.maxDate',
      )
      .getMany();

    const lastMessageMap = new Map(lastMessages.map((m) => [m.conversationId, m]));

    // Batch query: get last-read message dates for unread count calculation
    const lastReadIds = [...lastReadMap.values()].filter(Boolean) as string[];
    const lastReadMsgMap = new Map<string, Date>();
    if (lastReadIds.length > 0) {
      const lastReadMsgs = await this.messageRepo.find({
        where: { id: In(lastReadIds) },
        select: ['id', 'createdAt'],
      });
      for (const msg of lastReadMsgs) {
        lastReadMsgMap.set(msg.id, msg.createdAt);
      }
    }

    // Batch query: get unread counts for all conversations at once (parallelized)
    const unreadCountMap = new Map<string, number>();
    const unreadCounts = await Promise.all(
      conversations.map(async (conv) => {
        const lastReadId = lastReadMap.get(conv.id);
        if (lastReadId) {
          const readAt = lastReadMsgMap.get(lastReadId);
          if (readAt) {
            const count = await this.messageRepo
              .createQueryBuilder('m')
              .where('m.conversationId = :convId', { convId: conv.id })
              .andWhere('m.createdAt > :readAt', { readAt })
              .andWhere('m.isDeleted = false')
              .andWhere('m.senderId != :userId', { userId })
              .getCount();
            return { conversationId: conv.id, count };
          } else {
            return { conversationId: conv.id, count: 0 };
          }
        } else {
          // Never read — all messages from others are unread
          const count = await this.messageRepo
            .createQueryBuilder('m')
            .where('m.conversationId = :convId', { convId: conv.id })
            .andWhere('m.isDeleted = false')
            .andWhere('m.senderId != :userId', { userId })
            .getCount();
          return { conversationId: conv.id, count };
        }
      }),
    );
    for (const { conversationId, count } of unreadCounts) {
      unreadCountMap.set(conversationId, count);
    }

    const result = conversations.map((conv) => {
      const lastMessage = lastMessageMap.get(conv.id) || null;

      return {
        ...conv,
        participants: conv.participants.map((p) => ({
          userId: p.userId,
          firstName: p.user?.firstName ?? '',
          lastName: p.user?.lastName ?? '',
          role: p.role,
          joinedAt: p.joinedAt,
        })),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              type: lastMessage.type,
              content: lastMessage.isDeleted ? 'This message was deleted' : lastMessage.content,
              senderId: lastMessage.senderId,
              senderName: `${lastMessage.sender?.firstName ?? ''} ${lastMessage.sender?.lastName ?? ''}`.trim(),
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount: unreadCountMap.get(conv.id) || 0,
      };
    });

    return result;
  }

  async addGroupMember(conversationId: string, userId: string, addedBy: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId } });
    if (!conversation || conversation.type !== 'group') {
      throw new BadRequestException('Can only add members to group conversations');
    }

    // Verify the requesting user is a participant of the conversation
    const participants = await this.participantRepo.find({ where: { conversationId } });
    const requester = participants.find(p => p.userId === addedBy);
    if (!requester) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    const existing = await this.participantRepo.findOne({
      where: { conversationId, userId },
    });
    if (existing) return; // Already a member

    const participant = this.participantRepo.create({
      conversationId,
      userId,
      role: 'member',
    });
    await this.participantRepo.save(participant);

    // System message
    const systemMsg = this.messageRepo.create({
      conversationId,
      senderId: addedBy,
      type: 'system',
      content: `A new member was added to the group`,
    });
    await this.messageRepo.save(systemMsg);
  }

  async removeGroupMember(conversationId: string, userId: string, removedBy: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId } });
    if (!conversation || conversation.type !== 'group') {
      throw new BadRequestException('Can only remove members from group conversations');
    }

    // Verify the requesting user is a participant of the conversation
    const participants = await this.participantRepo.find({ where: { conversationId } });
    const requester = participants.find(p => p.userId === removedBy);
    if (!requester) {
      throw new ForbiddenException('Not a participant of this conversation');
    }

    await this.participantRepo.delete({ conversationId, userId });

    const systemMsg = this.messageRepo.create({
      conversationId,
      senderId: removedBy,
      type: 'system',
      content: `A member was removed from the group`,
    });
    await this.messageRepo.save(systemMsg);
  }

  // ── Messages ──

  async sendMessage(
    conversationId: string,
    senderId: string,
    data: {
      type: 'text' | 'file';
      content: string;
      replyToId?: string;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    },
  ): Promise<Message> {
    // Verify sender is a participant
    const participation = await this.participantRepo.findOne({
      where: { conversationId, userId: senderId },
    });
    if (!participation) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const message = this.messageRepo.create({
      conversationId,
      senderId,
      type: data.type,
      content: data.content,
      replyToId: data.replyToId || null,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      mimeType: data.mimeType || null,
    });

    const saved = await this.messageRepo.save(message);

    // Update conversation's updatedAt
    await this.conversationRepo.update(conversationId, { updatedAt: new Date() });

    // Load sender relation for the returned message
    return this.messageRepo.findOne({
      where: { id: saved.id },
      relations: ['sender'],
    }) as Promise<Message>;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    // Verify user is a participant
    const participation = await this.participantRepo.findOne({
      where: { conversationId, userId },
    });
    if (!participation) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .where('m.conversationId = :conversationId', { conversationId })
      .orderBy('m.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorMsg = await this.messageRepo.findOne({ where: { id: cursor } });
      if (cursorMsg) {
        qb.andWhere('m.createdAt < :cursorDate', { cursorDate: cursorMsg.createdAt });
      }
    }

    const messages = await qb.getMany();
    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    const resolved = messages.reverse();
    await this.resolveFileUrls(resolved);
    return { messages: resolved, hasMore };
  }

  async markAsRead(conversationId: string, userId: string, messageId: string): Promise<void> {
    await this.participantRepo.update(
      { conversationId, userId },
      { lastReadMessageId: messageId, lastReadAt: new Date() },
    );
  }

  async editMessage(messageId: string, userId: string, content: string): Promise<Message> {
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Cannot edit others\' messages');
    if (message.type === 'system') throw new BadRequestException('Cannot edit system messages');

    message.content = content;
    message.isEdited = true;
    return this.messageRepo.save(message);
  }

  async deleteMessage(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Cannot delete others\' messages');

    message.isDeleted = true;
    message.content = 'This message was deleted';
    return this.messageRepo.save(message);
  }

  async searchMessages(userId: string, query: string, limit = 20): Promise<Message[]> {
    // Get user's conversation IDs
    const participations = await this.participantRepo.find({
      where: { userId },
      select: ['conversationId'],
    });
    const convIds = participations.map((p) => p.conversationId);
    if (convIds.length === 0) return [];

    const escapedQuery = query.replace(/%/g, '\\%').replace(/_/g, '\\_');

    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .where('m.conversationId IN (:...convIds)', { convIds })
      .andWhere('m.isDeleted = false')
      .andWhere('m.content LIKE :query', { query: `%${escapedQuery}%` })
      .orderBy('m.createdAt', 'DESC')
      .take(limit)
      .getMany();

    await this.resolveFileUrls(messages);
    return messages;
  }

  /** Get conversation participant IDs (for broadcasting) */
  async getParticipantIds(conversationId: string): Promise<string[]> {
    const participants = await this.participantRepo.find({
      where: { conversationId },
      select: ['userId'],
    });
    return participants.map((p) => p.userId);
  }
}
