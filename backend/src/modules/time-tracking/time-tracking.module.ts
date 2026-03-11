import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkSession } from './entities/work-session.entity';
import { IdleInterval } from './entities/idle-interval.entity';
import { TimeTrackingService } from './time-tracking.service';
import { TimeTrackingController } from './time-tracking.controller';
import { ShiftsModule } from '../shifts/shifts.module';
import { FocusScoreModule } from '../focus-score/focus-score.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkSession, IdleInterval]),
    ShiftsModule,
    FocusScoreModule,
    AiModule,
  ],
  controllers: [TimeTrackingController],
  providers: [TimeTrackingService],
  exports: [TimeTrackingService],
})
export class TimeTrackingModule {}
