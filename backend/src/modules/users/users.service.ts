import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from '../../common/enums/user-status.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const invitationToken = uuidv4();
    const expiryHours = this.configService.get<number>('app.invitationExpiryHours', 72);
    const invitationExpiry = new Date();
    invitationExpiry.setHours(invitationExpiry.getHours() + expiryHours);

    const user = this.usersRepository.create({
      ...createUserDto,
      invitationToken,
      invitationExpiry,
      status: UserStatus.INVITED,
    });

    const savedUser = await this.usersRepository.save(user);

    try {
      await this.emailService.sendInvitationEmail(
        savedUser.email,
        savedUser.firstName,
        invitationToken,
      );
    } catch (error) {
      // Log but don't fail user creation if email fails
      console.error(`Failed to send invitation email to ${savedUser.email}:`, error);
    }

    return savedUser;
  }

  async resendInvite(id: string): Promise<void> {
    const user = await this.findById(id);

    if (user.status !== UserStatus.INVITED) {
      throw new ConflictException('Can only resend invitations to users with invited status');
    }

    const invitationToken = uuidv4();
    const expiryHours = this.configService.get<number>('app.invitationExpiryHours', 72);
    const invitationExpiry = new Date();
    invitationExpiry.setHours(invitationExpiry.getHours() + expiryHours);

    user.invitationToken = invitationToken;
    user.invitationExpiry = invitationExpiry;
    await this.usersRepository.save(user);

    await this.emailService.sendInvitationEmail(
      user.email,
      user.firstName,
      invitationToken,
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['shift'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByInvitationToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { invitationToken: token } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existing = await this.findByEmail(updateUserDto.email);
      if (existing) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.DEACTIVATED;
    return this.usersRepository.save(user);
  }

  async list(paginationDto: PaginationDto): Promise<PaginatedResponseDto<User>> {
    const { page, limit } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.usersRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }
}
