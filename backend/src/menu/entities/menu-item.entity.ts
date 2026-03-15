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

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) },
  })
  price: number;
  @Column({ default: 'Mains' }) category: string;
  @Column({ type: 'varchar', nullable: true }) tag: string | null;
  @Column({ type: 'varchar', nullable: true }) tagColor: string | null;
  @Column({ default: true }) isAvailable: boolean;
  @Column({ default: false }) isTodaysHighlight: boolean;
  @Column({ type: 'int', default: 0 }) sortOrder: number;
  @Column({ type: 'varchar', nullable: true }) locationId: string | null;
  @ManyToOne(() => Location, {
    nullable: true,
    eager: false,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
