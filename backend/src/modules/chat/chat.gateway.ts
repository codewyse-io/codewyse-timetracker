import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChatService } from './chat.service';
import { RealtimeGateway, AuthenticatedSocket, registerSocketHandler } from '../realtime/realtime.gateway';

@Injectable()
export class ChatGateway implements OnModuleInit {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  onModuleInit() {
    this.logger.log('Registering chat socket handlers...');

    registerSocketHandler('chat:send-message', async (client, data, callback) => {
      try {
        if (!client.user) {
          callback?.({ ok: false, error: 'Not authenticated' });
          return;
        }

        this.logger.log(`chat:send-message from ${client.user.email} in ${data.conversationId}`);

        // Validate fileUrl matches the expected S3 key pattern for this conversation
        if (data.fileUrl && !data.fileUrl.startsWith(`chat/${data.conversationId}/`)) {
          callback?.({ ok: false, error: 'Invalid file URL' });
          return;
        }

        const message = await this.chatService.sendMessage(data.conversationId, client.user.id, {
          type: data.type,
          content: data.content,
          replyToId: data.replyToId,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
        });

        // Resolve S3 presigned URL for file messages
        const resolvedFileUrl = await this.chatService.resolveFileUrl(message);

        const messagePayload = {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          sender: message.sender
            ? { id: message.sender.id, firstName: message.sender.firstName, lastName: message.sender.lastName }
            : null,
          type: message.type,
          content: message.content,
          replyToId: message.replyToId,
          fileUrl: resolvedFileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          mimeType: message.mimeType,
          isEdited: message.isEdited,
          isDeleted: message.isDeleted,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        };

        // Broadcast to all participants
        const participantIds = await this.chatService.getParticipantIds(data.conversationId);
        for (const userId of participantIds) {
          this.realtimeGateway.emitToUser(userId, 'chat:message', messagePayload);
        }

        callback?.({ ok: true, message: messagePayload });
      } catch (err: any) {
        this.logger.error(`Error in chat:send-message: ${err.message}`);
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('chat:typing', async (client, data) => {
      if (!client.user) return;

      const participantIds = await this.chatService.getParticipantIds(data.conversationId);

      // Verify user is a participant of this conversation
      if (!participantIds.includes(client.user.id)) return;
      for (const userId of participantIds) {
        if (userId !== client.user.id) {
          this.realtimeGateway.emitToUser(userId, 'chat:typing', {
            conversationId: data.conversationId,
            userId: client.user.id,
            firstName: '',
            isTyping: data.isTyping,
          });
        }
      }
    });

    registerSocketHandler('chat:mark-read', async (client, data) => {
      if (!client.user) return;

      // Verify user is a participant of this conversation
      const participantIds = await this.chatService.getParticipantIds(data.conversationId);
      if (!participantIds.includes(client.user.id)) return;

      await this.chatService.markAsRead(data.conversationId, client.user.id, data.messageId);

      // Reuse participantIds from above instead of fetching again
      for (const userId of participantIds) {
        if (userId !== client.user.id) {
          this.realtimeGateway.emitToUser(userId, 'chat:read-receipt', {
            conversationId: data.conversationId,
            userId: client.user.id,
            lastReadMessageId: data.messageId,
            readAt: new Date().toISOString(),
          });
        }
      }
    });

    registerSocketHandler('chat:edit-message', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }

        const message = await this.chatService.editMessage(data.messageId, client.user.id, data.content);
        const participantIds = await this.chatService.getParticipantIds(message.conversationId);
        for (const userId of participantIds) {
          this.realtimeGateway.emitToUser(userId, 'chat:message-updated', message);
        }
        callback?.({ ok: true });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    registerSocketHandler('chat:delete-message', async (client, data, callback) => {
      try {
        if (!client.user) { callback?.({ ok: false, error: 'Not authenticated' }); return; }

        const message = await this.chatService.deleteMessage(data.messageId, client.user.id);
        const participantIds = await this.chatService.getParticipantIds(message.conversationId);
        for (const userId of participantIds) {
          this.realtimeGateway.emitToUser(userId, 'chat:message-deleted', {
            id: message.id,
            conversationId: message.conversationId,
          });
        }
        callback?.({ ok: true });
      } catch (err: any) {
        callback?.({ ok: false, error: err.message });
      }
    });

    this.logger.log('Chat socket handlers registered');
  }
}
