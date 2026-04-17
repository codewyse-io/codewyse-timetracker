import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { S3Service } from '../s3/s3.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { User } from '../users/entities/user.entity';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly s3Service: S3Service,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Get('conversations')
  async getConversations(@Req() req: any) {
    return this.chatService.getUserConversations(req.user.id);
  }

  @Post('conversations')
  async createConversation(@Req() req: any, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(
      req.user.id,
      dto.type,
      dto.participantIds,
      dto.name,
    );
  }

  @Patch('conversations/:id')
  async renameConversation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    const name = (body?.name || '').trim();
    if (!name) throw new BadRequestException('Group name cannot be empty');
    if (name.length > 100) throw new BadRequestException('Group name too long (max 100 chars)');
    return this.chatService.renameConversation(req.user.id, id, name);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(Math.max(parseInt(limit || '', 10) || 50, 1), 100);
    return this.chatService.getMessages(
      conversationId,
      req.user.id,
      cursor,
      parsedLimit,
    );
  }

  @Post('conversations/:id/members')
  async addMember(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Body('userId') userId: string,
  ) {
    await this.chatService.addGroupMember(conversationId, userId, req.user.id);
    return { ok: true };
  }

  @Delete('conversations/:id/members/:userId')
  async removeMember(
    @Req() req: any,
    @Param('id') conversationId: string,
    @Param('userId') userId: string,
  ) {
    await this.chatService.removeGroupMember(conversationId, userId, req.user.id);
    return { ok: true };
  }

  @Post('conversations/:id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return callback(new BadRequestException(`File type ${file.mimetype} is not allowed`), false);
        }
        callback(null, true);
      },
    }),
  )
  async uploadAttachment(
    @Req() req: any,
    @Param('id') conversationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Verify user is a participant of the conversation
    const participantIds = await this.chatService.getParticipantIds(conversationId);
    if (!participantIds.includes(req.user.id)) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const s3Key = await this.s3Service.uploadFile(file, `chat/${conversationId}`);
    const presignedUrl = await this.s3Service.getPresignedUrl(s3Key, 3600);
    return {
      s3Key,
      presignedUrl,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  @Get('search')
  async searchMessages(
    @Req() req: any,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    const parsedSearchLimit = Math.min(Math.max(parseInt(limit || '', 10) || 20, 1), 100);
    return this.chatService.searchMessages(req.user.id, query, parsedSearchLimit);
  }

  @Get('conversations/:conversationId/files/:filename')
  async getFile(
    @Param('conversationId') conversationId: string,
    @Param('filename') filename: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    // Verify user is participant
    const participantIds = await this.chatService.getParticipantIds(conversationId);
    if (!participantIds.includes(req.user.id)) {
      throw new ForbiddenException('Not a participant');
    }

    // Sanitize filename to prevent path traversal
    const sanitized = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'storage', 'chat', conversationId, sanitized);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    return res.sendFile(filePath);
  }

  @Get('users')
  async getUsers(@Req() req: any, @CurrentOrg() orgId: string) {
    // Only return users from the same organization as the requester.
    // Without this filter, the "New Conversation" dialog shows every user
    // in the system, which breaks multi-tenancy.
    const users = await this.userRepo.find({
      where: {
        status: 'active' as any,
        id: Not(req.user.id),
        organizationId: orgId,
      },
      select: ['id', 'firstName', 'lastName', 'email', 'designation'],
    });
    return users;
  }
}
