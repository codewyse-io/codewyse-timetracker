import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);
  private readonly adminPanelUrl: string;

  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.adminPanelUrl = this.configService.get<string>('ADMIN_PANEL_URL', 'https://hrms.codewyse.site');
  }

  async create(
    userId: string,
    dto: CreateLeaveRequestDto,
    attachments: string[],
  ): Promise<LeaveRequest> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException('End date must be after start date');
    }

    const totalDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;

    const leaveRequest = this.leaveRequestRepo.create({
      userId,
      subject: dto.subject,
      message: dto.message,
      startDate: dto.startDate,
      endDate: dto.endDate,
      totalDays,
      attachments: attachments.length > 0 ? attachments : undefined,
      status: LeaveStatus.PENDING,
    } as Partial<LeaveRequest>);

    const saved = await this.leaveRequestRepo.save(leaveRequest);

    // Notify all admins via email
    this.notifyAdmins(userId, dto, totalDays).catch((err) => {
      this.logger.error(`Failed to notify admins about leave request: ${err.message}`);
    });

    return saved;
  }

  private async notifyAdmins(
    userId: string,
    dto: CreateLeaveRequestDto,
    totalDays: number,
  ): Promise<void> {
    const [employee, admins] = await Promise.all([
      this.usersService.findById(userId),
      this.usersService.findByRole('admin'),
    ]);

    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const leaveRequestsUrl = `${this.adminPanelUrl}/leave-requests`;

    for (const admin of admins) {
      this.emailService.sendLeaveRequestNotification(
        admin.email,
        employeeName,
        dto.subject,
        dto.startDate,
        dto.endDate,
        totalDays,
        dto.message || '',
        leaveRequestsUrl,
      ).catch((err) => {
        this.logger.error(`Failed to email admin ${admin.email}: ${err.message}`);
      });
    }
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponseDto<LeaveRequest>> {
    const { page, limit } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.leaveRequestRepo.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findById(id: string): Promise<LeaveRequest> {
    const request = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!request) {
      throw new NotFoundException('Leave request not found');
    }
    return request;
  }

  async findByUserId(userId: string): Promise<LeaveRequest[]> {
    return this.leaveRequestRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, dto: UpdateLeaveStatusDto): Promise<LeaveRequest> {
    const request = await this.findById(id);

    if (request.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Can only update status of pending requests');
    }

    request.status = dto.status;
    if (dto.adminNotes) {
      request.adminNotes = dto.adminNotes;
    }

    const saved = await this.leaveRequestRepo.save(request);

    // Update consumed leaves if approved
    if (dto.status === LeaveStatus.APPROVED) {
      const user = await this.usersService.findById(request.userId);
      user.consumedLeaves = (user.consumedLeaves || 0) + request.totalDays;
      await this.usersService.save(user);
    }

    return saved;
  }
}
