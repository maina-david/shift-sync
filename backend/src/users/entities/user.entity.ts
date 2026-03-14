import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude, Transform } from 'class-transformer';
import { Location } from '../../locations/entities/location.entity';
import { Skill } from '../../skills/entities/skill.entity';
import { Availability } from './availability.entity';
import { AvailabilityException } from './availability-exception.entity';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STAFF })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  desiredHoursPerWeek: number;

  @Transform(({ value }) => (value !== null && value !== undefined ? parseFloat(value) : null))
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  hourlyRate: number | null;

  @Column({ type: 'json', nullable: true })
  notificationPreferences: { inApp: boolean; email: boolean } | null;

  @ManyToMany(() => Skill, { eager: false })
  @JoinTable({ name: 'user_skills' })
  skills: Skill[];

  @ManyToMany(() => Location, { eager: false })
  @JoinTable({ name: 'user_location_certifications' })
  certifiedLocations: Location[];

  @ManyToMany(() => Location, { eager: false })
  @JoinTable({ name: 'manager_location_assignments' })
  managedLocations: Location[];

  @OneToMany(() => Availability, (a) => a.user)
  availabilities: Availability[];

  @OneToMany(() => AvailabilityException, (a) => a.user)
  availabilityExceptions: AvailabilityException[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
