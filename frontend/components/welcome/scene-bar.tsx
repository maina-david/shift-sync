'use client';

// Shared procedural bar components — bottles, accessories and enhanced counter.
// Used by both WelcomeCanvas (scene-models.tsx) and LoginCanvas (login-scene.tsx).

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Palette } from './scene-config';

// ── Procedural bottle shapes ──────────────────────────────────────────────────

export function WineBottle({ position, color = '#1a4020', labelColor = '#8B1a1a', rotationY = 0 }: {
  position: [number, number, number]; color?: string; labelColor?: string; rotationY?: number;
}) {
  const pts = useMemo(() => [
    new THREE.Vector2(0.000, 0.000),
    new THREE.Vector2(0.028, 0.003),
    new THREE.Vector2(0.029, 0.012),
    new THREE.Vector2(0.028, 0.195),
    new THREE.Vector2(0.024, 0.228),
    new THREE.Vector2(0.013, 0.256),
    new THREE.Vector2(0.011, 0.278),
    new THREE.Vector2(0.011, 0.328),
    new THREE.Vector2(0.013, 0.334),
    new THREE.Vector2(0.013, 0.340),
  ], []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <latheGeometry args={[pts, 22]} />
        <meshPhysicalMaterial color={color} roughness={0.06} metalness={0} transmission={0.72} thickness={0.5} ior={1.52} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0.108, 0]} castShadow>
        <cylinderGeometry args={[0.0298, 0.0298, 0.076, 22]} />
        <meshStandardMaterial color={labelColor} roughness={0.80} />
      </mesh>
      <mesh position={[0, 0.318, 0]}>
        <cylinderGeometry args={[0.0118, 0.0118, 0.030, 16]} />
        <meshStandardMaterial color={labelColor} roughness={0.42} metalness={0.38} />
      </mesh>
    </group>
  );
}

export function WhiskeyBottle({ position, color = '#b85a10', rotationY = 0 }: {
  position: [number, number, number]; color?: string; rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow position={[0, 0.110, 0]}>
        <boxGeometry args={[0.058, 0.220, 0.058]} />
        <meshPhysicalMaterial color={color} roughness={0.07} metalness={0} transmission={0.64} thickness={0.44} ior={1.5} transparent opacity={0.88} />
      </mesh>
      <mesh castShadow position={[0, 0.232, 0]}>
        <cylinderGeometry args={[0.022, 0.034, 0.044, 14]} />
        <meshPhysicalMaterial color={color} roughness={0.07} metalness={0} transmission={0.64} thickness={0.44} ior={1.5} transparent opacity={0.88} />
      </mesh>
      <mesh castShadow position={[0, 0.272, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.060, 12]} />
        <meshPhysicalMaterial color={color} roughness={0.07} metalness={0} transmission={0.64} thickness={0.44} ior={1.5} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0.306, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.020, 12]} />
        <meshStandardMaterial color="#1e1e1e" roughness={0.40} metalness={0.68} />
      </mesh>
      <mesh position={[0, 0.110, 0.030]}>
        <planeGeometry args={[0.050, 0.090]} />
        <meshStandardMaterial color="#f0e6c0" roughness={0.90} />
      </mesh>
    </group>
  );
}

export function GinBottle({ position, color = '#bcd8ea', rotationY = 0 }: {
  position: [number, number, number]; color?: string; rotationY?: number;
}) {
  const pts = useMemo(() => [
    new THREE.Vector2(0.000, 0.000),
    new THREE.Vector2(0.026, 0.004),
    new THREE.Vector2(0.026, 0.006),
    new THREE.Vector2(0.024, 0.236),
    new THREE.Vector2(0.016, 0.268),
    new THREE.Vector2(0.011, 0.290),
    new THREE.Vector2(0.011, 0.358),
    new THREE.Vector2(0.013, 0.364),
  ], []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <latheGeometry args={[pts, 22]} />
        <meshPhysicalMaterial color={color} roughness={0.05} metalness={0} transmission={0.82} thickness={0.28} ior={1.5} transparent opacity={0.76} />
      </mesh>
      <mesh position={[0, 0.136, 0]}>
        <cylinderGeometry args={[0.0258, 0.0258, 0.094, 22]} />
        <meshStandardMaterial color="#1a4a1a" roughness={0.84} />
      </mesh>
      <mesh position={[0, 0.352, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.026, 14]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.38} metalness={0.68} />
      </mesh>
    </group>
  );
}

export function TequilaBottle({ position, rotationY = 0 }: {
  position: [number, number, number]; rotationY?: number;
}) {
  const pts = useMemo(() => [
    new THREE.Vector2(0.000, 0.000),
    new THREE.Vector2(0.032, 0.005),
    new THREE.Vector2(0.033, 0.012),
    new THREE.Vector2(0.032, 0.108),
    new THREE.Vector2(0.030, 0.115),
    new THREE.Vector2(0.026, 0.178),
    new THREE.Vector2(0.015, 0.210),
    new THREE.Vector2(0.012, 0.238),
    new THREE.Vector2(0.012, 0.308),
    new THREE.Vector2(0.015, 0.313),
  ], []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <latheGeometry args={[pts, 22]} />
        <meshPhysicalMaterial color="#dfc880" roughness={0.06} metalness={0} transmission={0.74} thickness={0.42} ior={1.5} transparent opacity={0.83} />
      </mesh>
      <mesh position={[0, 0.090, 0]}>
        <cylinderGeometry args={[0.033, 0.033, 0.065, 22]} />
        <meshStandardMaterial color="#8B2020" roughness={0.74} />
      </mesh>
      <mesh position={[0, 0.298, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.026, 14]} />
        <meshStandardMaterial color="#c8a828" roughness={0.26} metalness={0.74} />
      </mesh>
    </group>
  );
}

export function RumBottle({ position, rotationY = 0 }: {
  position: [number, number, number]; rotationY?: number;
}) {
  const pts = useMemo(() => [
    new THREE.Vector2(0.000, 0.000),
    new THREE.Vector2(0.030, 0.004),
    new THREE.Vector2(0.031, 0.010),
    new THREE.Vector2(0.030, 0.185),
    new THREE.Vector2(0.026, 0.215),
    new THREE.Vector2(0.013, 0.242),
    new THREE.Vector2(0.012, 0.260),
    new THREE.Vector2(0.012, 0.318),
    new THREE.Vector2(0.014, 0.322),
  ], []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <latheGeometry args={[pts, 20]} />
        <meshPhysicalMaterial color="#5a1a05" roughness={0.07} metalness={0} transmission={0.58} thickness={0.48} ior={1.5} transparent opacity={0.90} />
      </mesh>
      <mesh position={[0, 0.095, 0]}>
        <cylinderGeometry args={[0.0305, 0.0305, 0.068, 20]} />
        <meshStandardMaterial color="#c0a030" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.305, 0]}>
        <cylinderGeometry args={[0.0145, 0.0145, 0.026, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.40} metalness={0.65} />
      </mesh>
    </group>
  );
}

export function VodkaBottle({ position, rotationY = 0 }: {
  position: [number, number, number]; rotationY?: number;
}) {
  const pts = useMemo(() => [
    new THREE.Vector2(0.000, 0.000),
    new THREE.Vector2(0.025, 0.004),
    new THREE.Vector2(0.025, 0.006),
    new THREE.Vector2(0.024, 0.210),
    new THREE.Vector2(0.016, 0.240),
    new THREE.Vector2(0.011, 0.262),
    new THREE.Vector2(0.011, 0.345),
    new THREE.Vector2(0.013, 0.350),
  ], []);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <latheGeometry args={[pts, 22]} />
        <meshPhysicalMaterial color="#ddeeff" roughness={0.04} metalness={0} transmission={0.90} thickness={0.20} ior={1.5} transparent opacity={0.70} />
      </mesh>
      <mesh position={[0, 0.130, 0]}>
        <cylinderGeometry args={[0.0252, 0.0252, 0.060, 22]} />
        <meshStandardMaterial color="#1a2a5a" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.338, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.024, 14]} />
        <meshStandardMaterial color="#888888" roughness={0.30} metalness={0.75} />
      </mesh>
    </group>
  );
}

// ── Bar accessories ───────────────────────────────────────────────────────────

export function CocktailShaker({ position, rotationY = 0 }: {
  position: [number, number, number]; rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow position={[0, 0.112, 0]}>
        <cylinderGeometry args={[0.040, 0.052, 0.224, 22]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.10} metalness={0.94} envMapIntensity={2.5} />
      </mesh>
      <mesh castShadow position={[0, 0.238, 0]}>
        <cylinderGeometry args={[0.032, 0.040, 0.050, 22]} />
        <meshStandardMaterial color="#d0d0d0" roughness={0.14} metalness={0.92} envMapIntensity={2.5} />
      </mesh>
      <mesh castShadow position={[0, 0.265, 0]}>
        <sphereGeometry args={[0.032, 18, 12, 0, Math.PI * 2, 0, 0.68]} />
        <meshStandardMaterial color="#d0d0d0" roughness={0.14} metalness={0.92} envMapIntensity={2.5} />
      </mesh>
      <mesh position={[0, 0.276, 0]}>
        <cylinderGeometry args={[0.013, 0.020, 0.022, 14]} />
        <meshStandardMaterial color="#c4c4c4" roughness={0.20} metalness={0.88} />
      </mesh>
    </group>
  );
}

export function IceBucket({ position, isDark }: { position: [number, number, number]; isDark: boolean }) {
  const cubePositions: [number, number, number][] = [
    [-0.018, 0.066, 0.010],
    [ 0.020, 0.058,-0.013],
    [ 0.000, 0.074, 0.022],
    [-0.024, 0.068,-0.017],
  ];
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.056, 0.044, 0.108, 24]} />
        <meshStandardMaterial color={isDark ? '#9e9e9e' : '#cccccc'} roughness={0.14} metalness={0.92} envMapIntensity={2} />
      </mesh>
      <mesh position={[0, 0.010, 0]}>
        <cylinderGeometry args={[0.050, 0.040, 0.094, 24]} />
        <meshStandardMaterial color="#111111" roughness={0.82} />
      </mesh>
      {([-1, 1] as const).map((s, i) => (
        <mesh key={i} position={[s * 0.057, 0.040, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.013, 0.003, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#bbbbbb" roughness={0.20} metalness={0.88} />
        </mesh>
      ))}
      {cubePositions.map((pos, i) => (
        <mesh key={i} position={pos} rotation={[0.3 * i, 0.55 * i, 0.22 * i]}>
          <boxGeometry args={[0.023, 0.023, 0.023]} />
          <meshPhysicalMaterial color="#d4eeff" roughness={0.04} metalness={0} transmission={0.90} thickness={0.08} ior={1.31} transparent opacity={0.76} />
        </mesh>
      ))}
    </group>
  );
}

export function BarMat({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh receiveShadow>
        <boxGeometry args={[0.60, 0.008, 0.30]} />
        <meshStandardMaterial color="#0c0c0c" roughness={0.97} metalness={0} />
      </mesh>
      {([-0.18, 0, 0.18] as const).map((dx, i) =>
        ([-0.08, 0.08] as const).map((dz, j) => (
          <mesh key={`${i}${j}`} position={[dx, 0.004, dz]}>
            <cylinderGeometry args={[0.014, 0.014, 0.009, 10]} />
            <meshStandardMaterial color="#080808" roughness={1} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ── Bottle type helpers ───────────────────────────────────────────────────────

export type BottleDef = {
  x: number;
  type: 'wine' | 'whiskey' | 'gin' | 'tequila' | 'rum' | 'vodka';
  color?: string;
  label?: string;
};

export function BottleAt({ b, shelfY, shlZ, index }: {
  b: BottleDef; shelfY: number; shlZ: number; index: number;
}) {
  const pos: [number, number, number] = [b.x, shelfY + 0.022, shlZ - 0.04];
  const ry = (index * 0.31) % (Math.PI * 2);
  switch (b.type) {
    case 'whiskey': return <WhiskeyBottle position={pos} color={b.color ?? '#b85a10'} rotationY={ry} />;
    case 'tequila': return <TequilaBottle position={pos} rotationY={ry} />;
    case 'gin':     return <GinBottle     position={pos} color={b.color ?? '#bcd8ea'} rotationY={ry} />;
    case 'rum':     return <RumBottle     position={pos} rotationY={ry} />;
    case 'vodka':   return <VodkaBottle   position={pos} rotationY={ry} />;
    default:        return <WineBottle    position={pos} color={b.color ?? '#1a4020'} labelColor={b.label ?? '#8B0000'} rotationY={ry} />;
  }
}

// ── Full enhanced bar counter — configurable for any scene ────────────────────

export function EnhancedBarCounter({
  p, isDark, BZ, W = 3.6, shlZOffset = 0.55, backZOffset = 0.72,
  bottomRow, midRow, topRow,
  topY = 0.965,
  pendantX = [-1.18, 0, 1.18] as const,
  renderExtras,
}: {
  p: Palette;
  isDark: boolean;
  BZ: number;
  W?: number;
  shlZOffset?: number;
  backZOffset?: number;
  bottomRow: BottleDef[];
  midRow: BottleDef[];
  topRow: BottleDef[];
  topY?: number;
  pendantX?: readonly number[];
  renderExtras?: () => React.ReactNode;
}) {
  const BACK_Z = BZ + backZOffset;
  const SHL_Z  = BZ + shlZOffset;
  const SHL_Y  = [1.09, 1.58, 2.07] as const;

  return (
    <group>
      {/* ── Counter body */}
      <mesh castShadow receiveShadow position={[0, 0.44, BZ]}>
        <boxGeometry args={[W, 0.88, 0.52]} />
        <meshStandardMaterial color={p.woodDark} roughness={0.60} metalness={0.03} />
      </mesh>

      {/* Front face recessed panels */}
      {[-W * 0.30, 0, W * 0.30].map((px, i) => (
        <mesh key={i} position={[px, 0.44, BZ - 0.256]}>
          <boxGeometry args={[W * 0.29, 0.80, 0.006]} />
          <meshStandardMaterial color={isDark ? '#221a0e' : '#d4c49e'} roughness={0.72} metalness={0.02} />
        </mesh>
      ))}

      {/* Brass toe-kick */}
      <mesh position={[0, 0.034, BZ - 0.248]}>
        <boxGeometry args={[W, 0.052, 0.018]} />
        <meshStandardMaterial color={p.brass} roughness={0.22} metalness={0.82} />
      </mesh>

      {/* ── Marble counter top */}
      <mesh castShadow receiveShadow position={[0, topY - 0.002, BZ - 0.02]}>
        <boxGeometry args={[W + 0.26, 0.070, 0.68]} />
        <meshStandardMaterial
          color={isDark ? '#161210' : '#f2eee8'}
          roughness={0.05}
          metalness={0.06}
          envMapIntensity={isDark ? 1.2 : 2.5}
        />
      </mesh>
      {/* Marble waterfall edge */}
      <mesh position={[0, topY - 0.044, BZ - 0.354]}>
        <boxGeometry args={[W + 0.28, 0.018, 0.006]} />
        <meshStandardMaterial color={isDark ? '#2e2a26' : '#ffffff'} roughness={0.04} metalness={0.08} />
      </mesh>

      {/* ── Back storage cabinet */}
      <mesh castShadow receiveShadow position={[0, 0.36, BZ + 0.57]}>
        <boxGeometry args={[W, 0.72, 0.42]} />
        <meshStandardMaterial color={p.woodDark} roughness={0.60} metalness={0.02} />
      </mesh>

      {/* ── Backbar mirror */}
      <mesh position={[0, 1.78, BACK_Z + 0.052]}>
        <planeGeometry args={[W - 0.06, 2.30]} />
        <meshStandardMaterial
          color={isDark ? '#686868' : '#aaaaaa'}
          roughness={0.02}
          metalness={0.98}
          envMapIntensity={isDark ? 3.5 : 5.0}
        />
      </mesh>
      {/* Mirror brass frame */}
      <mesh position={[0, 2.940, BACK_Z + 0.052]}>
        <boxGeometry args={[W + 0.02, 0.038, 0.026]} />
        <meshStandardMaterial color={p.brass} roughness={0.22} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.636, BACK_Z + 0.052]}>
        <boxGeometry args={[W + 0.02, 0.038, 0.026]} />
        <meshStandardMaterial color={p.brass} roughness={0.22} metalness={0.82} />
      </mesh>
      {([-W / 2 + 0.035, W / 2 - 0.035] as const).map((sx, i) => (
        <mesh key={i} position={[sx, 1.78, BACK_Z + 0.052]}>
          <boxGeometry args={[0.038, 2.33, 0.026]} />
          <meshStandardMaterial color={p.brass} roughness={0.22} metalness={0.82} />
        </mesh>
      ))}

      {/* ── Shelving back panel */}
      <mesh position={[0, 1.62, BACK_Z + 0.042]}>
        <boxGeometry args={[W, 1.96, 0.06]} />
        <meshStandardMaterial color={p.woodDark} roughness={0.55} metalness={0.02} />
      </mesh>

      {/* ── Shelves with LED underlighting */}
      {SHL_Y.map((sy, i) => (
        <group key={i}>
          <mesh castShadow receiveShadow position={[0, sy, SHL_Z]}>
            <boxGeometry args={[W - 0.02, 0.038, 0.38]} />
            <meshStandardMaterial color={p.wood} roughness={0.46} metalness={0.02} />
          </mesh>
          <mesh position={[0, sy - 0.020, SHL_Z - 0.08]}>
            <planeGeometry args={[W - 0.32, 0.016]} />
            <meshStandardMaterial
              color={isDark ? '#ffbb44' : '#fff8e0'}
              emissive={isDark ? '#ffaa33' : '#ffe8a0'}
              emissiveIntensity={isDark ? 6 : 3}
            />
          </mesh>
          <pointLight
            position={[0, sy + 0.06, SHL_Z - 0.04]}
            intensity={isDark ? 1.6 : 0.65}
            color={isDark ? '#ffbb44' : '#fff8e0'}
            distance={3.0}
            decay={2}
          />
        </group>
      ))}

      {/* Shelf side verticals */}
      {([-W / 2 + 0.07, W / 2 - 0.07] as const).map((sx, i) => (
        <mesh key={i} position={[sx, 1.62, SHL_Z - 0.01]}>
          <boxGeometry args={[0.06, 1.96, 0.40]} />
          <meshStandardMaterial color={p.woodDark} roughness={0.55} metalness={0.02} />
        </mesh>
      ))}

      {/* ── Brass foot rail */}
      <mesh position={[0, 0.158, BZ - 0.254]}>
        <boxGeometry args={[W, 0.028, 0.022]} />
        <meshStandardMaterial color={p.brass} roughness={0.22} metalness={0.82} />
      </mesh>
      {[-W * 0.33, 0, W * 0.33].map((px, i) => (
        <mesh key={i} position={[px, 0.082, BZ - 0.254]}>
          <cylinderGeometry args={[0.014, 0.014, 0.160, 12]} />
          <meshStandardMaterial color={p.brass} roughness={0.22} metalness={0.82} />
        </mesh>
      ))}

      {/* ── Pendant lights over bar */}
      {pendantX.map((px, i) => (
        <group key={i} position={[px, 3.30, BZ - 0.20]}>
          <mesh>
            <cylinderGeometry args={[0.005, 0.005, 0.90, 4]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.90} />
          </mesh>
          <mesh position={[0, -0.55, 0]}>
            <coneGeometry args={[0.148, 0.218, 24, 1, true]} />
            <meshStandardMaterial color={isDark ? '#181210' : '#26201a'} roughness={0.44} metalness={0.36} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.55, 0]}>
            <coneGeometry args={[0.142, 0.212, 24, 1, true]} />
            <meshStandardMaterial
              color={isDark ? '#ff9830' : '#ffc850'}
              emissive={isDark ? '#ff6810' : '#ffaa30'}
              emissiveIntensity={isDark ? 2.2 : 1.1}
              side={THREE.BackSide}
            />
          </mesh>
          <mesh position={[0, -0.448, 0]}>
            <sphereGeometry args={[0.026, 14, 12]} />
            <meshStandardMaterial color="#ffffc8" emissive="#ffcc60" emissiveIntensity={isDark ? 6 : 3} />
          </mesh>
          <pointLight
            position={[0, -0.50, 0]}
            intensity={isDark ? 4.0 : 1.8}
            color={isDark ? '#ff9030' : '#ffe8b0'}
            distance={6.0}
            decay={2}
          />
        </group>
      ))}

      {/* ── Bottles on shelves */}
      {bottomRow.map((b, i) => <BottleAt key={i} b={b} shelfY={SHL_Y[0]} shlZ={SHL_Z} index={i} />)}
      {midRow.map((b, i)    => <BottleAt key={i} b={b} shelfY={SHL_Y[1]} shlZ={SHL_Z} index={i} />)}
      {topRow.map((b, i)    => <BottleAt key={i} b={b} shelfY={SHL_Y[2]} shlZ={SHL_Z} index={i} />)}

      {/* ── Bar-top accessories */}
      <BarMat position={[0.12, topY + 0.005, BZ - 0.14]} />
      <CocktailShaker position={[-0.62, topY + 0.010, BZ - 0.12]} rotationY={0.38} />
      <IceBucket position={[W * 0.22, topY + 0.005, BZ - 0.11]} isDark={isDark} />

      {/* Bar spoon in ice bucket */}
      <mesh position={[W * 0.24, topY + 0.096, BZ - 0.07]} rotation={[0.22, 0.10, 0.14]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.24, 6]} />
        <meshStandardMaterial color="#c8c8c8" roughness={0.16} metalness={0.84} />
      </mesh>

      {/* Garnish dish */}
      <mesh position={[-W * 0.35, topY + 0.009, BZ - 0.11]}>
        <cylinderGeometry args={[0.070, 0.062, 0.016, 24]} />
        <meshStandardMaterial color={isDark ? '#8a7860' : '#d4c8a8'} roughness={0.28} metalness={0.54} />
      </mesh>
      <mesh position={[-W * 0.35, topY + 0.022, BZ - 0.11]} rotation={[0, 0.4, 0.30]}>
        <cylinderGeometry args={[0.028, 0.028, 0.010, 6]} />
        <meshStandardMaterial color="#4a8a1a" roughness={0.72} />
      </mesh>

      {/* Cocktail straws */}
      {([0.02, 0.05] as const).map((dx, i) => (
        <mesh key={i} position={[0.10 + dx, topY + 0.044, BZ - 0.07]} rotation={[0.09, 0, 0.04 * (i ? -1 : 1)]}>
          <cylinderGeometry args={[0.003, 0.003, 0.16, 6]} />
          <meshStandardMaterial color={i === 0 ? '#e82020' : '#f0f0f0'} roughness={0.72} />
        </mesh>
      ))}

      {/* Muddler */}
      <mesh position={[-0.38, topY + 0.034, BZ - 0.07]} rotation={[0.15, 0, 0.06]} castShadow>
        <cylinderGeometry args={[0.006, 0.010, 0.22, 8]} />
        <meshStandardMaterial color={isDark ? '#4a3220' : '#8a6a40'} roughness={0.75} metalness={0.05} />
      </mesh>

      {/* Counter area light */}
      <pointLight
        position={[0, 2.5, BZ + 0.32]}
        intensity={isDark ? 3.0 : 1.1}
        color={isDark ? '#ff9a3c' : '#fff4d0'}
        distance={9}
        decay={2}
      />

      {renderExtras?.()}
    </group>
  );
}
