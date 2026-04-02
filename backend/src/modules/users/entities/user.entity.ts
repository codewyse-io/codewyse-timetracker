import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { Exclude } from 'class-transformer';
import { Shift } from '../../shifts/entities/shift.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Exclude()
  @Column({ nullable: true })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.EMPLOYEE })
  role: Role;

  @Column({ length: 100, nullable: true })
  designation: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  hourlyRate: number;

  @Column({ nullable: true })
  shiftId: string;

  @ManyToOne(() => Shift, { eager: false, nullable: true })
  @JoinColumn({ name: 'shiftId' })
  shift: Shift;

  @Column({ type: 'int', default: 20 })
  allowedLeavesPerYear: number;

  @Column({ type: 'int', default: 0 })
  consumedLeaves: number;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.INVITED })
  status: UserStatus;

  @Exclude()
  @Column({ nullable: true })
  invitationToken: string;

  @Column({ type: 'datetime', nullable: true })
  invitationExpiry: Date;

  // ── Bank Account Information ──
  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName: string;

  @Column({ name: 'account_holder_name', type: 'varchar', length: 150, nullable: true })
  accountHolderName: string;

  @Column({ name: 'account_number', type: 'varchar', length: 50, nullable: true })
  accountNumber: string;

  @Column({ name: 'iban', type: 'varchar', length: 50, nullable: true })
  iban: string;

  @Exclude()
  @Column({ nullable: true })
  refreshToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
