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

  @Column({ nullable: true, type: 'text' })
  comment: string | null;

  /** Was the shift adequately staffed? */
  @Column({ type: 'tinyint', nullable: true })
  adequatelyStaffed: boolean | null;

  /** Would staff like more shifts like this? */
  @Column({ type: 'tinyint', nullable: true })
  wouldRepeat: boolean | null;

  @CreateDateColumn()
  createdAt: Date;
}
