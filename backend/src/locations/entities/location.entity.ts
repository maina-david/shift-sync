import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface FloorZoneConfig {
  id: string;
  label: string;
  position: [number, number];
  size: [number, number];
  skills: string[];
  colorLight: string;
  colorDark: string;
  colorSelectedLight: string;
  colorSelectedDark: string;
}

/** Default floor plan zones — applied to every new location until customised */
export const DEFAULT_FLOOR_ZONES: FloorZoneConfig[] = [
  {
    id: 'dining',
    label: 'Dining Room',
    position: [0, 0],
    size: [6, 5],
    skills: ['Server'],
    colorLight: '#818cf8',
    colorDark: '#4f46e5',
    colorSelectedLight: '#6366f1',
    colorSelectedDark: '#4338ca',
  },
  {
    id: 'bar',
    label: 'Bar',
    position: [-4, -3.5],
    size: [3, 2],
    skills: ['Bartender', 'Barback'],
    colorLight: '#fb923c',
    colorDark: '#ea580c',
    colorSelectedLight: '#f97316',
    colorSelectedDark: '#c2410c',
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    position: [4, -3.5],
    size: [3, 2],
    skills: ['Line Cook', 'Shift Lead'],
    colorLight: '#facc15',
    colorDark: '#ca8a04',
    colorSelectedLight: '#eab308',
    colorSelectedDark: '#a16207',
  },
  {
    id: 'host-stand',
    label: 'Host Stand',
    position: [0, 3.5],
    size: [2, 1.5],
    skills: ['Host/Hostess'],
    colorLight: '#4ade80',
    colorDark: '#16a34a',
    colorSelectedLight: '#22c55e',
    colorSelectedDark: '#15803d',
  },
];

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  /** IANA timezone identifier, e.g. 'America/New_York', 'America/Los_Angeles' */
  @Column()
  timezone: string;

  @Column()
  address: string;

  /** Geographic coordinates for weather and map integrations */
  @Column({ type: 'double', nullable: true })
  lat: number | null;

  @Column({ type: 'double', nullable: true })
  lng: number | null;

  /** Per-location floor plan zone configuration — editable by admins via PUT /locations/:id/zones */
  @Column({ type: 'json', nullable: true, default: null })
  zones: FloorZoneConfig[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
