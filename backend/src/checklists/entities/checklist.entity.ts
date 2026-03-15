import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Shift } from '../../shifts/entities/shift.entity';
import { Location } from '../../locations/entities/location.entity';

export enum ChecklistType {
  OPENING = 'opening',
  CLOSING = 'closing',
  CUSTOM = 'custom',
}

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completedAt: string | null;
  completedById: string | null;
}

@Entity('checklists')
export class Checklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ChecklistType })
  type: ChecklistType;

  @Column()
  title: string;

  @ManyToOne(() => Location, { eager: true })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column()
  locationId: string;

  @ManyToOne(() => Shift, { nullable: true, eager: false })
  @JoinColumn({ name: 'shiftId' })
  shift: Shift | null;

  @Column({ type: 'varchar', nullable: true })
  shiftId: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User | null;

  @Column({ type: 'varchar', nullable: true })
  assignedToId: string | null;

  @Column({ type: 'json' })
  items: ChecklistItem[] = [];

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
