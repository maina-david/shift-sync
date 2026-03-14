import type { ShiftAssignment, FloorZoneConfig } from '@/lib/types';

// Re-export as ZoneConfig for local use
export type ZoneConfig = FloorZoneConfig;

export interface FloorPlanProps {
  locationId: string;
  assignments: ShiftAssignment[];
  /** Zone layout loaded from the API — falls back to hardcoded defaults when null */
  zones?: ZoneConfig[] | null;
}
