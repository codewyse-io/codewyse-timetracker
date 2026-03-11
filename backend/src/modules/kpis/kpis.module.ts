import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiDefinition } from './entities/kpi-definition.entity';
import { KpiEntry } from './entities/kpi-entry.entity';
import { KpisService } from './kpis.service';
import { KpisController } from './kpis.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KpiDefinition, KpiEntry])],
  controllers: [KpisController],
  providers: [KpisService],
  exports: [KpisService],
})
export class KpisModule {}
