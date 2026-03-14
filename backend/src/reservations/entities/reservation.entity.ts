import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Location } from '../../locations/entities/location.entity';

export enum ReservationStatus {
  PENDING   = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  NO_SHOW   = 'no_show',
}

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() customerName: string;
  @Column() email: string;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;

  @Column({ type: 'varchar', length: 10 }) date: string;  // YYYY-MM-DD
  @Column({ type: 'varchar', length: 5  }) time: string;  // HH:mm
  @Column({ type: 'int' }) partySize: number;

  @ManyToOne(() => Location, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;

  @Column({ type: 'varchar', nullable: true }) locationId: string | null;

  @Column({ type: 'enum', enum: ReservationStatus, default: ReservationStatus.PENDING })
  status: ReservationStatus;

  @Column({ type: 'text', nullable: true }) notes: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
