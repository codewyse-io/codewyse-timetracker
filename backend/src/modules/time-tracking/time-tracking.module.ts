import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkSession } from './entities/work-session.entity';
import { IdleInterval } from './entities/idle-interval.entity';
import { ActivityLog } from './entities/activity-log.entity';
import { TimeTrackingService } from './time-tracking.service';
import { TimeTrackingController } from './time-tracking.controller';
import { ShiftsModule } from '../shifts/shifts.module';
import { FocusScoreModule } from '../focus-score/focus-score.module';
import { AiModule } from '../ai/ai.module';
import { AppCategoriesModule } from '../app-categories/app-categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkSession, IdleInterval, ActivityLog]),
    ShiftsModule,
    FocusScoreModule,
    AiModule,
    AppCategoriesModule,
  ],
  controllers: [TimeTrackingController],
  providers: [TimeTrackingService],
  exports: [TimeTrackingService],
})
export class TimeTrackingModule {}
