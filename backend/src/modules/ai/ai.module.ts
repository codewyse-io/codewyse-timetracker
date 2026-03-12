import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiInsight } from './entities/ai-insight.entity';
import { AiCoachingTip } from './entities/ai-coaching-tip.entity';
import { WorkSession } from '../time-tracking/entities/work-session.entity';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiInsight, AiCoachingTip, WorkSession])],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
