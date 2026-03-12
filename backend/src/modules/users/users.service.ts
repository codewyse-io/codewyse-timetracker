import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from '../../common/enums/user-status.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private generateTempPassword(): string {
    return crypto.randomBytes(6).toString('base64url'); // ~8 char readable password
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Verify hash immediately after creation
    const verifyResult = await bcrypt.compare(tempPassword, hashedPassword);
    this.logger.log(`Creating user ${createUserDto.email} | tempPassword: "${tempPassword}" | hash verify: ${verifyResult}`);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      status: UserStatus.INVITED,
    });

    const savedUser = await this.usersRepository.save(user);

    // Read back from DB and verify hash wasn't corrupted during save
    const dbUser = await this.usersRepository.findOne({ where: { id: savedUser.id } });
    const dbVerify = dbUser ? await bcrypt.compare(tempPassword, dbUser.password) : false;
    this.logger.log(`User saved: ${savedUser.email} | DB readback verify: ${dbVerify} | DB hash length: ${dbUser?.password?.length}`);

    try {
      await this.emailService.sendCredentialsEmail(
        savedUser.email,
        savedUser.firstName,
        tempPassword,
      );
    } catch (error) {
      console.error(`Failed to send credentials email to ${savedUser.email}:`, error);
    }

    return savedUser;
  }

  async resendInvite(id: string): Promise<void> {
    const user = await this.findById(id);

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    user.password = hashedPassword;
    await this.usersRepository.save(user);

    await this.emailService.sendCredentialsEmail(
      user.email,
      user.firstName,
      tempPassword,
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

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.usersRepository.remove(user);
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
