// ── Scene layout constants ────────────────────────────────────────────────────

/** Square table positions [x, z] — 2 columns × 3 rows */
export const TABLE_POSITIONS: [number, number][] = [
  [-2.0, -3.2],
  [ 2.0, -3.2],
  [-2.0, -0.6],
  [ 2.0, -0.6],
  [-2.0,  2.0],
  [ 2.0,  2.0],
];

/** 4 chairs around each square table at 90° intervals */
export const CHAIR_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const;

/** White column positions [x, z] — pairs along the sides */
export const COLUMN_POS: [number, number][] = [
  [-4.5, -5.0], [4.5, -5.0],   // back pair  (ocean side)
  [-4.5,  0.5], [4.5,  0.5],   // mid pair
  [-4.5,  5.0], [4.5,  5.0],   // front pair (entrance side)
];

// ── Material palette ──────────────────────────────────────────────────────────

export type Palette = {
  bg: string; fog: string; floor: string; floorLine: string;
  wall: string; wainscot: string; ceiling: string; beam: string;
  wood: string; woodDark: string; brass: string; cushion: string;
  cloth: string; glass: string; glassGlow: string;
};

/** Tropical daytime — white stone, rattan, ocean blue */
export const LIGHT_PALETTE = {
  bg:        '#87ceef',
  fog:       '#b8e0f5',
  floor:     '#f2ede6',    // cream stone tile
  floorLine: '#e0d8d0',
  wall:      '#f0ece4',    // white column
  wainscot:  '#e8e4dc',
  ceiling:   '#a87840',    // (unused — sky shows through pergola)
  beam:      '#a07840',    // pergola beam — honey wood
  wood:      '#c09650',    // rattan chair frame
  woodDark:  '#886030',
  brass:     '#c4a050',
  cushion:   '#3a6eb8',    // blue coastal cushion
  cloth:     '#fafaf8',    // white tablecloth
  glass:     '#b0d4f0',
  glassGlow: '#4898c8',
} as const;

/** Evening coastal — warm amber glow, deep blue, candlelit */
export const DARK_PALETTE = {
  bg:        '#07111e',
  fog:       '#07111e',
  floor:     '#1a1610',
  floorLine: '#1e1a14',
  wall:      '#2e2a22',    // aged column in evening light
  wainscot:  '#241e18',
  ceiling:   '#100e0b',
  beam:      '#3c2c18',
  wood:      '#5a3c20',    // darker rattan
  woodDark:  '#2c1e10',
  brass:     '#6a5020',
  cushion:   '#1e3560',    // deep navy cushion
  cloth:     '#2e2a24',    // linen in candlelight
  glass:     '#0e2540',
  glassGlow: '#1e4878',
} as const;

export function getPalette(isDark: boolean): Palette {
  return isDark ? DARK_PALETTE : LIGHT_PALETTE;
}
