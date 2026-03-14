import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Location } from '../../locations/entities/location.entity';
import { User } from '../../users/entities/user.entity';

export interface TemplateShift {
  dayOfWeek: number;          // 0=Mon … 6=Sun (week-relative)
  startTime: string;          // HH:mm
  endTime: string;            // HH:mm
  requiredSkillId: string | null;
  headcount: number;
  notes: string | null;
}

@Entity('schedule_templates')
export class ScheduleTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Location, { eager: true })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column()
  locationId: string;

  @Column({ type: 'json' })
  shifts: TemplateShift[];

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'varchar', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
