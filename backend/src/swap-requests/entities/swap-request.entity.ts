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
import { ShiftAssignment } from '../../shifts/entities/shift-assignment.entity';
import { User } from '../../users/entities/user.entity';

export enum SwapRequestStatus {
  PENDING = 'pending', // Waiting for target staff to accept
  ACCEPTED = 'accepted', // Target accepted; waiting for manager
  REJECTED = 'rejected', // Target rejected
  APPROVED = 'approved', // Manager approved — swap is live
  DENIED = 'denied', // Manager denied
  CANCELLED = 'cancelled', // Requester cancelled
}

@Entity('swap_requests')
export class SwapRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ShiftAssignment, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fromAssignmentId' })
  fromAssignment: ShiftAssignment;

  @Index()
  @Column()
  fromAssignmentId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'toUserId' })
  toUser: User;

  @Index()
  @Column()
  toUserId: string;

  @Column({
    type: 'enum',
    enum: SwapRequestStatus,
    default: SwapRequestStatus.PENDING,
  })
  status: SwapRequestStatus;

  @Column({ nullable: true, type: 'text', default: null })
  reason: string | null;

  @Column({ nullable: true, type: 'text', default: null })
  managerNote: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'managerId' })
  manager: User | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  managerId: string | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
