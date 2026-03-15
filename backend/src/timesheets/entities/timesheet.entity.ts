import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Shift } from '../../shifts/entities/shift.entity';
import { ShiftAssignment } from '../../shifts/entities/shift-assignment.entity';

export enum TimesheetStatus {
  PENDING = 'pending', // clocked out, awaiting manager approval
  APPROVED = 'approved', // approved for payroll
  REJECTED = 'rejected', // sent back to staff for correction
}

@Entity('timesheets')
export class Timesheet {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'staffId' })
  staff: User;
  @Index() @Column() staffId: string;

  @ManyToOne(() => Shift, { eager: true, nullable: true })
  @JoinColumn({ name: 'shiftId' })
  shift: Shift | null;
  @Column({ type: 'varchar', nullable: true, default: null }) shiftId:
    | string
    | null;

  @ManyToOne(() => ShiftAssignment, { nullable: true })
  @JoinColumn({ name: 'assignmentId' })
  assignment: ShiftAssignment | null;
  @Column({ type: 'varchar', nullable: true, default: null }) assignmentId:
    | string
    | null;

  /** Actual clock-in time (ISO UTC) */
  @Column({ type: 'datetime' }) clockIn: Date;

  /** Actual clock-out time (ISO UTC) — null while still clocked in */
  @Index() @Column({ type: 'datetime', nullable: true }) clockOut: Date | null;

  /** Total break time in minutes */
  @Column({ type: 'int', default: 0 }) breakMinutes: number;

  /** Computed actual hours worked (set on clock-out) */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  actualHours: number | null;

  @Index()
  @Column({
    type: 'enum',
    enum: TimesheetStatus,
    default: TimesheetStatus.PENDING,
  })
  status: TimesheetStatus;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User | null;
  @Column({ type: 'varchar', nullable: true }) reviewedById: string | null;
  @Column({ nullable: true, type: 'text' }) managerNote: string | null;
  @Column({ type: 'datetime', nullable: true }) reviewedAt: Date | null;

  /** Location ID for scoping */
  @Index() @Column({ type: 'varchar', nullable: true }) locationId:
    | string
    | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
