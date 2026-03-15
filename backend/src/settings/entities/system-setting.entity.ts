import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  /** Dot-notation key, e.g. "scheduling.minRestHours" */
  @PrimaryColumn({ type: 'varchar', length: 120 })
  key: string;

  /** JSON-serialised value — numbers, strings, booleans, arrays */
  @Column({ type: 'json' })
  value: unknown;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  description: string | null;

  /** Whether this setting is active. Disabled settings are stored but ignored by the runtime. */
  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
