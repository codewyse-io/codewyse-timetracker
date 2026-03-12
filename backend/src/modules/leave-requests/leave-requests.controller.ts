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
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Leave Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a leave request' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('attachments', 5, {
      storage: diskStorage({
        destination: './uploads/leave-attachments',
        filename: (_req, file, cb) => {
          const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async create(
    @Req() req: any,
    @Body() dto: CreateLeaveRequestDto,
    @UploadedFiles() files: Array<{ filename: string }>,
  ) {
    const attachments = files?.map((f) => `/uploads/leave-attachments/${f.filename}`) || [];
    return this.leaveRequestsService.create(req.user.id, dto, attachments);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all leave requests (admin)' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.leaveRequestsService.findAll(paginationDto);
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
