import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Location } from '../../locations/entities/location.entity';

export enum MessageType {
  DIRECT = 'direct',
  ANNOUNCEMENT = 'announcement',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MessageType })
  type: MessageType;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column()
  senderId: string;

  /** null for announcements (goes to location) */
  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn({ name: 'recipientId' })
  recipient: User | null;

  @Column({ type: 'varchar', nullable: true })
  recipientId: string | null;

  /** for announcements: scoped to location; null = all locations */
  @ManyToOne(() => Location, { nullable: true, eager: false })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;

  @Column({ type: 'varchar', nullable: true })
  locationId: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
