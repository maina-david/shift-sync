import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** E.g. 'shift', 'shift_assignment', 'swap_request', 'drop_request' */
  @Column()
  entity: string;

  @Column()
  entityId: string;

  /** E.g. 'created', 'updated', 'published', 'approved', 'override_approved' */
  @Column()
  action: string;

  @Column({ type: 'json', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  after: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'performedById' })
  performedBy: User | null;

  @Column({ type: 'varchar', nullable: true })
  performedById: string | null;

  /** Scoped location for shift/assignment/swap/drop events — enables efficient filtering */
  @Column({ nullable: true, type: 'varchar' })
  locationId: string | null;

  /** Reason for override actions (e.g. 7th consecutive day) */
  @Column({ nullable: true, type: 'text' })
  note: string | null;

  @CreateDateColumn()
  timestamp: Date;
}
