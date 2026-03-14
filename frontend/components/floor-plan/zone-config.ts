import type { ZoneConfig } from './floor-plan-types';

export const ZONES: ZoneConfig[] = [
  {
    id: 'dining',
    label: 'Dining Room',
    position: [0, 0, 0],
    size: [6, 5],
    skills: ['Server'],
    colorLight: '#818cf8',      // indigo-400
    colorDark: '#4f46e5',       // indigo-600
    colorSelectedLight: '#6366f1',
    colorSelectedDark: '#4338ca',
  },
  {
    id: 'bar',
    label: 'Bar',
    position: [-4, 0, -3.5],
    size: [3, 2],
    skills: ['Bartender', 'Barback'],
    colorLight: '#fb923c',      // orange-400
    colorDark: '#ea580c',       // orange-600
    colorSelectedLight: '#f97316',
    colorSelectedDark: '#c2410c',
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    position: [4, 0, -3.5],
    size: [3, 2],
    skills: ['Line Cook', 'Shift Lead'],
    colorLight: '#facc15',      // yellow-400
    colorDark: '#ca8a04',       // yellow-600
    colorSelectedLight: '#eab308',
    colorSelectedDark: '#a16207',
  },
  {
    id: 'host-stand',
    label: 'Host Stand',
    position: [0, 0, 3.5],
    size: [2, 1.5],
    skills: ['Host/Hostess'],
    colorLight: '#4ade80',      // green-400
    colorDark: '#16a34a',       // green-600
    colorSelectedLight: '#22c55e',
    colorSelectedDark: '#15803d',
  },
];

export function getZoneColor(zone: ZoneConfig, isDark: boolean, selected: boolean): string {
  if (selected) return isDark ? zone.colorSelectedDark : zone.colorSelectedLight;
  return isDark ? zone.colorDark : zone.colorLight;
}
