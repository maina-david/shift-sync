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

export enum DropRequestStatus {
  OPEN = 'open',             // Waiting to be claimed
  CLAIMED = 'claimed',       // Someone claimed it; waiting for manager
  APPROVED = 'approved',     // Manager approved transfer
  REJECTED = 'rejected',     // Manager rejected
  EXPIRED = 'expired',       // 24h before shift; auto-expired
  CANCELLED = 'cancelled',   // Original staff cancelled
}

@Entity('drop_requests')
export class DropRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ShiftAssignment, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignmentId' })
  assignment: ShiftAssignment;

  @Index()
  @Column()
  assignmentId: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'claimedById' })
  claimedBy: User | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  claimedById: string | null;

  @Index()
  @Column({ type: 'enum', enum: DropRequestStatus, default: DropRequestStatus.OPEN })
  status: DropRequestStatus;

  @Column({ nullable: true, type: 'text', default: null })
  reason: string | null;

  @Column({ nullable: true, type: 'text', default: null })
  managerNote: string | null;

  /** Auto-set to 24h before shift start time */
  @Column({ type: 'datetime' })
  expiresAt: Date;

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
