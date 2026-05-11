import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeerReviewsService } from './peer-reviews.service';
import { PeerReviewsController } from './peer-reviews.controller';
import { PeerReviewSurvey } from './entities/peer-review-survey.entity';
import { PeerReviewResponse } from './entities/peer-review-response.entity';
import { PeerReviewAnswer } from './entities/peer-review-answer.entity';
import { User } from '../users/entities/user.entity';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PeerReviewSurvey,
      PeerReviewResponse,
      PeerReviewAnswer,
      User,
    ]),
    TeamsModule,
  ],
  controllers: [PeerReviewsController],
  providers: [PeerReviewsService],
})
export class PeerReviewsModule {}
