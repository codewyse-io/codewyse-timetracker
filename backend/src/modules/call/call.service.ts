import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallLog } from './entities/call-log.entity';

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    @InjectRepository(CallLog)
    private readonly callLogRepo: Repository<CallLog>,
  ) {}

  async createCallLog(data: {
    id: string;
    type: 'audio' | 'video';
    initiatorId: string;
    participantIds: string[];
    state: string;
    startedAt: string;
  }): Promise<CallLog> {
    const log = this.callLogRepo.create({
      id: data.id,
      type: data.type,
      initiatorId: data.initiatorId,
      participantIds: data.participantIds,
      state: data.state as any,
      startedAt: new Date(data.startedAt),
    });
    return this.callLogRepo.save(log);
  }

  async updateCallLog(
    callId: string,
    update: Partial<Pick<CallLog, 'state' | 'connectedAt' | 'endedAt' | 'durationSeconds'>>,
  ): Promise<void> {
    await this.callLogRepo.update(callId, update);
  }

  async getCallHistory(userId: string, limit = 50): Promise<CallLog[]> {
    return this.callLogRepo
      .createQueryBuilder('cl')
      .leftJoinAndSelect('cl.initiator', 'initiator')
      .where('JSON_CONTAINS(cl.participantIds, :userId)', {
        userId: JSON.stringify(userId),
      })
      .orderBy('cl.startedAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
