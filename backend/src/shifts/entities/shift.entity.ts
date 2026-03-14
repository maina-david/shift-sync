import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Location } from '../../locations/entities/location.entity';
import { Skill } from '../../skills/entities/skill.entity';
import { ShiftAssignment } from './shift-assignment.entity';
import { User } from '../../users/entities/user.entity';

export enum ShiftStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Location, { eager: true })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Index()
  @Column()
  locationId: string;

  /** YYYY-MM-DD stored in location timezone */
  @Column({ type: 'varchar', length: 10 })
  date: string;

  /** HH:mm in location timezone */
  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  /** HH:mm in location timezone — may be next calendar day for overnight shifts */
  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  @ManyToOne(() => Skill, { eager: true, nullable: true })
  @JoinColumn({ name: 'requiredSkillId' })
  requiredSkill: Skill | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  requiredSkillId: string | null;

  @Column({ type: 'int', default: 1 })
  headcount: number;

  @Column({ type: 'enum', enum: ShiftStatus, default: ShiftStatus.DRAFT })
  status: ShiftStatus;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @OneToMany(() => ShiftAssignment, (sa) => sa.shift)
  assignments: ShiftAssignment[];

  @Column({ type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'publishedById' })
  publishedBy: User | null;

  @Column({ type: 'varchar', nullable: true })
  publishedById: string | null;

  /** Indicates 11pm-3am style overnight shifts */
  @Column({ default: false })
  isOvernight: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
