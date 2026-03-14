import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ShiftAssignment } from '../../shifts/entities/shift-assignment.entity';

@Entity('shift_feedback')
export class ShiftFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'staffId' })
  staff: User;

  @Column()
  staffId: string;

  @ManyToOne(() => ShiftAssignment, { eager: true })
  @JoinColumn({ name: 'assignmentId' })
  assignment: ShiftAssignment;

  @Column()
  assignmentId: string;

  /** 1–5 star rating */
  @Column({ type: 'tinyint' })
  rating: number;

  @Column({ nullable: true, type: 'text', default: null })
  comment: string | null;

  @Column({ type: 'tinyint', nullable: true, default: null })
  adequatelyStaffed: boolean | null;

  @Column({ type: 'tinyint', nullable: true, default: null })
  wouldRepeat: boolean | null;

  @CreateDateColumn()
  createdAt: Date;
}
