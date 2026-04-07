import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { User } from '../users/entities/user.entity';
import { WorkSession } from '../time-tracking/entities/work-session.entity';
import { OrganizationsController } from './organizations.controller';
import { SuperAdminController } from './super-admin.controller';
import { OrganizationsService } from './organizations.service';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, User, WorkSession]),
    S3Module,
  ],
  controllers: [OrganizationsController, SuperAdminController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
