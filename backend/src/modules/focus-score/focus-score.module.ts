import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyFocusScore } from './entities/daily-focus-score.entity';
import { WorkSession } from '../time-tracking/entities/work-session.entity';
import { IdleInterval } from '../time-tracking/entities/idle-interval.entity';
import { User } from '../users/entities/user.entity';
import { FocusScoreService } from './focus-score.service';
import { FocusScoreController } from './focus-score.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyFocusScore, WorkSession, IdleInterval, User]),
  ],
  controllers: [FocusScoreController],
  providers: [FocusScoreService],
  exports: [FocusScoreService],
})
export class FocusScoreModule {}
