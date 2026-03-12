import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { S3Module } from './modules/s3/s3.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, appConfig],
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
    LeaveRequestsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
})
export class AppModule {}
