import type { ShiftAssignment } from '@/lib/types';

export interface ZoneConfig {
  id: string;
  label: string;
  position: [number, number, number]; // [x, y, z] — y is always 0
  size: [number, number]; // [width, depth]
  skills: string[];
  colorLight: string; // hex
  colorDark: string;  // hex
  colorSelectedLight: string;
  colorSelectedDark: string;
}

export interface FloorPlanProps {
  locationId: string;
  assignments: ShiftAssignment[];
}
