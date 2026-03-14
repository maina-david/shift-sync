import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  SHIFT_ASSIGNED = 'SHIFT_ASSIGNED',
  SHIFT_UPDATED = 'SHIFT_UPDATED',
  SHIFT_CANCELLED = 'SHIFT_CANCELLED',
  SCHEDULE_PUBLISHED = 'SCHEDULE_PUBLISHED',
  SWAP_REQUEST_RECEIVED = 'SWAP_REQUEST_RECEIVED',
  SWAP_REQUEST_ACCEPTED = 'SWAP_REQUEST_ACCEPTED',
  SWAP_REQUEST_REJECTED = 'SWAP_REQUEST_REJECTED',
  SWAP_REQUEST_APPROVED = 'SWAP_REQUEST_APPROVED',
  SWAP_REQUEST_DENIED = 'SWAP_REQUEST_DENIED',
  SWAP_CANCELLED_SHIFT_EDIT = 'SWAP_CANCELLED_SHIFT_EDIT',
  DROP_REQUEST_CREATED = 'DROP_REQUEST_CREATED',
  DROP_REQUEST_CLAIMED = 'DROP_REQUEST_CLAIMED',
  DROP_REQUEST_APPROVED = 'DROP_REQUEST_APPROVED',
  DROP_REQUEST_EXPIRED = 'DROP_REQUEST_EXPIRED',
  OVERTIME_WARNING = 'OVERTIME_WARNING',
  AVAILABILITY_CHANGED = 'AVAILABILITY_CHANGED',
  SHIFT_REMINDER = 'SHIFT_REMINDER',
  TIME_OFF_REMINDER = 'TIME_OFF_REMINDER',
  SWAP_PENDING_REMINDER = 'SWAP_PENDING_REMINDER',
  SCHEDULE_UNPUBLISHED_WARNING = 'SCHEDULE_UNPUBLISHED_WARNING',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  userId: string;

  @Column({ type: 'varchar', length: 60 })
  type: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'varchar', nullable: true })
  entityType: string | null;

  @Column({ type: 'varchar', nullable: true })
  entityId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
