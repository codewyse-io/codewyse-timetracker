import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../../common/enums/user-status.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async acceptInvitation(token: string, password: string) {
    const user = await this.usersService.findByInvitationToken(token);

    if (!user) {
      throw new BadRequestException('Invalid invitation token');
    }

    if (user.invitationExpiry < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    if (user.status !== UserStatus.INVITED) {
      throw new BadRequestException('Invitation has already been accepted');
    }

    user.password = await this.hashPassword(password);
    user.status = UserStatus.ACTIVE;
    user.invitationToken = null as any;
    user.invitationExpiry = null as any;

    const savedUser = await this.usersService.save(user);
    const tokens = await this.generateTokens(savedUser);
    await this.updateRefreshToken(savedUser.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(savedUser),
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);

    const isValid = await this.comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await this.hashPassword(newPassword);
    await this.usersService.save(user);
  }

  async logout(userId: string) {
    const user = await this.usersService.findById(userId);
    user.refreshToken = null as any;
    await this.usersService.save(user);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    if (user.status !== UserStatus.ACTIVE) {
      return null;
    }

    const isPasswordValid = await this.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiration') ?? '15m',
      } as any),
      this.jwtService.signAsync(payload as any, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiration') ?? '7d',
      } as any),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = await bcrypt.hash(refreshToken, 12);
    const user = await this.usersService.findById(userId);
    user.refreshToken = hashedToken;
    await this.usersService.save(user);
  }

  private sanitizeUser(user: User) {
    const { password, refreshToken, invitationToken, ...result } = user;
    return result;
  }
}
