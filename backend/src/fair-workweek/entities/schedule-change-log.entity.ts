import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Shift } from '../../shifts/entities/shift.entity';
import { User } from '../../users/entities/user.entity';

export enum ChangeType {
  PUBLISHED = 'published',
  MODIFIED = 'modified',
  CANCELLED = 'cancelled',
}

@Entity('schedule_change_logs')
export class ScheduleChangeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, { eager: true })
  @JoinColumn({ name: 'shiftId' })
  shift: Shift;

  @Column()
  shiftId: string;

  @Column({ type: 'enum', enum: ChangeType })
  changeType: ChangeType;

  @Column({ type: 'datetime' })
  changedAt: Date;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  hoursBeforeShift: number;

  @Column({ default: false })
  triggersPredictabilityPay: boolean;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  predictabilityPayAmount: number | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'changedById' })
  changedBy: User | null;

  @Column({ type: 'varchar', nullable: true })
  changedById: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
