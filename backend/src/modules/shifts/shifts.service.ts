import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
  ) {}

  async create(dto: CreateShiftDto): Promise<Shift> {
    const shift = this.shiftRepository.create(dto);
    return this.shiftRepository.save(shift);
  }

  async findAll(): Promise<Shift[]> {
    return this.shiftRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Shift> {
    const shift = await this.shiftRepository.findOne({ where: { id } });
    if (!shift) {
      throw new NotFoundException(`Shift with ID "${id}" not found`);
    }
    return shift;
  }

  async update(id: string, dto: UpdateShiftDto): Promise<Shift> {
    const shift = await this.findById(id);
    Object.assign(shift, dto);
    return this.shiftRepository.save(shift);
  }

  async softDelete(id: string): Promise<void> {
    const shift = await this.findById(id);

    // Check if any users are assigned to this shift
    // We query the users table to see if any user has this shiftId
    // Using a raw query since we don't own the User entity
    const usersAssigned = await this.shiftRepository.query(
      'SELECT COUNT(*) as count FROM users WHERE shiftId = ?',
      [id],
    );

    const count = parseInt(usersAssigned[0]?.count ?? '0', 10);
    if (count > 0) {
      throw new BadRequestException(
        `Cannot delete shift "${shift.name}" — ${count} user(s) are still assigned to it`,
      );
    }

    shift.isActive = false;
    await this.shiftRepository.save(shift);
  }

  /**
   * Get the current time in a given IANA timezone using Intl API.
   */
  private getNowInTimezone(timezone: string): { day: string; minutes: number } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);

    const weekdayPart = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hourPart = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const minutePart = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

    const shortToFull: Record<string, string> = {
      Sun: 'sunday', Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday',
      Thu: 'thursday', Fri: 'friday', Sat: 'saturday',
    };

    return {
      day: shortToFull[weekdayPart] ?? 'monday',
      minutes: hourPart * 60 + minutePart,
    };
  }

  /**
   * Check if the current time and day fall within the given shift's schedule.
   * Uses the shift's configured timezone to determine "now".
   */
  async isWithinShift(shiftId: string): Promise<boolean> {
    const shift = await this.findById(shiftId);
    if (!shift.isActive) return false;

    const tz = shift.timezone || 'UTC';
    const { day: currentDay, minutes: currentMinutes } = this.getNowInTimezone(tz);

    if (!shift.allowedDays.includes(currentDay)) {
      return false;
    }

    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);
    const shiftStart = startH * 60 + startM;
    const shiftEnd = endH * 60 + endM;

    // Handle overnight shifts (e.g., 22:00 - 06:00)
    if (shiftEnd <= shiftStart) {
      return currentMinutes >= shiftStart || currentMinutes <= shiftEnd;
    }

    return currentMinutes >= shiftStart && currentMinutes <= shiftEnd;
  }
}
