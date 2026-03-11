import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyReport } from './entities/weekly-report.entity';
import { WorkSession } from '../time-tracking/entities/work-session.entity';
import { DailyFocusScore } from '../focus-score/entities/daily-focus-score.entity';
import { KpiEntry } from '../kpis/entities/kpi-entry.entity';
import { User } from '../users/entities/user.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeeklyReport,
      WorkSession,
      DailyFocusScore,
      KpiEntry,
      User,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
