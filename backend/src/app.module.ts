import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import appConfig from './config/app.config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module';
import { FocusScoreModule } from './modules/focus-score/focus-score.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { KpisModule } from './modules/kpis/kpis.module';
import { QueueModule } from './modules/queue/queue.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AiModule } from './modules/ai/ai.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { AppCategoriesModule } from './modules/app-categories/app-categories.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { DownloadsModule } from './modules/downloads/downloads.module';
import { S3Module } from './modules/s3/s3.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ChatModule } from './modules/chat/chat.module';
import { CallModule } from './modules/call/call.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  controllers: [AppController],
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, appConfig],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
        autoLogging: true,
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get('database')!,
    }),
    UsersModule,
    AuthModule,
    EmailModule,
    ShiftsModule,
    TimeTrackingModule,
    FocusScoreModule,
    PayrollModule,
    KpisModule,
    QueueModule,
    ReportsModule,
    AiModule,
    S3Module,
    OrganizationsModule,
    LeaveRequestsModule,
    AnnouncementsModule,
    DownloadsModule,
    RealtimeModule,
    ChatModule,
    CallModule,
    AppCategoriesModule,
  ],
})
export class AppModule {}
