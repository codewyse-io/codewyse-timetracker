import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { S3Service } from '../s3/s3.service';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a leave request' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async create(
    @Req() req: any,
    @Body() dto: CreateLeaveRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentOrg() orgId: string,
  ) {
    const attachments: string[] = [];
    if (files?.length) {
      for (const file of files) {
        const key = await this.s3Service.uploadFile(file, 'leave-attachments');
        attachments.push(key);
      }
    }
    return this.leaveRequestsService.create(req.user.id, dto, attachments, orgId);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all leave requests (admin)' })
  findAll(@Query() paginationDto: PaginationDto, @CurrentOrg() orgId: string) {
    return this.leaveRequestsService.findAll(paginationDto, orgId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my leave requests' })
  findMyRequests(@Req() req: any) {
    return this.leaveRequestsService.findByUserId(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave request details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaveRequestsService.findById(id);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Get presigned URLs for leave request attachments' })
  async getAttachmentUrls(@Param('id', ParseUUIDPipe) id: string) {
    const request = await this.leaveRequestsService.findById(id);
    if (!request.attachments?.length) {
      return [];
    }
    return Promise.all(
      request.attachments.map(async (key) => ({
        key,
        url: await this.s3Service.getPresignedUrl(key),
        filename: key.split('/').pop(),
      })),
    );
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve or reject a leave request (admin)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveStatusDto,
  ) {
    return this.leaveRequestsService.updateStatus(id, dto);
  }
}
