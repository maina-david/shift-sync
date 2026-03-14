'use client';

import type { Palette } from './scene-config';
import { TABLE_POSITIONS } from './scene-config';

// ── Scene lighting for open-air coastal restaurant ────────────────────────────

export function Lighting({ p, isDark }: { p: Palette; isDark: boolean }) {
  return (
    <>
      {/* ── Primary sun — bright diagonal from ocean side ── */}
      <directionalLight
        position={[3, 9, -6]}
        intensity={isDark ? 0.30 : 2.6}
        color={isDark ? '#c4a060' : '#fff8e8'}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={32}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* ── Sky fill — soft blue from above (open pergola) ── */}
      <directionalLight
        position={[0, 8, 3]}
        intensity={isDark ? 0.04 : 0.85}
        color={isDark ? '#1a2a50' : '#a8d8f8'}
      />

      {/* ── Warm bounce fill from the stone floor ── */}
      <directionalLight
        position={[0, -3, 0]}
        intensity={isDark ? 0.02 : 0.18}
        color={isDark ? '#0a0806' : '#f5e8d0'}
      />

      {/* ── Side fill — warm late-afternoon from right ── */}
      <directionalLight
        position={[-5, 4, 2]}
        intensity={isDark ? 0.05 : 0.45}
        color={isDark ? '#402010' : '#ffe4b8'}
      />

      {/* ── Evening: candle on every table ── */}
      {isDark && TABLE_POSITIONS.map(([tx, tz], i) => (
        <pointLight
          key={i}
          position={[tx, 0.96, tz]}
          intensity={1.4}
          color="#ffb040"
          distance={3.5}
          decay={2}
        />
      ))}

      {/* ── Night ambient glow from the sky ── */}
      {isDark && (
        <pointLight
          position={[0, 6, -4]}
          intensity={0.35}
          color="#203060"
          distance={18}
          decay={2}
        />
      )}
    </>
  );
}
