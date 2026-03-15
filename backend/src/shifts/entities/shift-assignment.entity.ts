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
import { Shift } from './shift.entity';
import { User } from '../../users/entities/user.entity';

export enum AssignmentStatus {
  ASSIGNED = 'assigned',
  PENDING_SWAP = 'pending_swap',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('shift_assignments')
export class ShiftAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shift, (s) => s.assignments, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'shiftId' })
  shift: Shift;

  @Index()
  @Column()
  shiftId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'staffId' })
  staff: User;

  @Index()
  @Column()
  staffId: string;

  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    default: AssignmentStatus.ASSIGNED,
  })
  status: AssignmentStatus;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'assignedById' })
  assignedBy: User | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  assignedById: string | null;

  @Column({ type: 'datetime', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
