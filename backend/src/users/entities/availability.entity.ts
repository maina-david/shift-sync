import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('availabilities')
@Unique(['userId', 'dayOfWeek'])
export class Availability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.availabilities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  /** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  @Column({ type: 'int' })
  dayOfWeek: number;

  /** HH:mm — interpreted in the shift location's timezone */
  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  /** HH:mm */
  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
