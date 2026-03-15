import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('availability_exceptions')
export class AvailabilityException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.availabilityExceptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  /** YYYY-MM-DD */
  @Column({ type: 'varchar', length: 10 })
  date: string;

  /** HH:mm — null means entire day is unavailable */
  @Column({ type: 'varchar', length: 5, nullable: true })
  startTime: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  endTime: string | null;

  /** true = completely unavailable on this date */
  @Column({ default: false })
  isUnavailable: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
