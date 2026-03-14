'use client';

import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Grid } from '@react-three/drei';
import { useTheme } from 'next-themes';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { FloorZone } from './floor-zone';
import { ZoneDetailPanel } from './zone-detail-panel';
import { ZONES } from './zone-config';
import type { FloorPlanProps } from './floor-plan-types';
import type { ZoneConfig } from './floor-plan-types';

function Scene({
  assignments,
  selectedZone,
  onSelectZone,
  isDark,
  zones,
}: {
  assignments: FloorPlanProps['assignments'];
  selectedZone: ZoneConfig | null;
  onSelectZone: (z: ZoneConfig | null) => void;
  isDark: boolean;
  zones: ZoneConfig[];
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null!);

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 18, 0.001]} zoom={42} />
      <OrbitControls
        ref={controlsRef}
        enableRotate={false}
        enableZoom
        minZoom={24}
        maxZoom={90}
        enablePan
        target={[0, 0, 0]}
      />

      <ambientLight intensity={isDark ? 0.4 : 0.7} />
      <directionalLight position={[5, 10, 5]} intensity={isDark ? 0.6 : 1} castShadow />
      <pointLight position={[-4, 8, -3]} intensity={0.4} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.07, 0]} receiveShadow>
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial color={isDark ? '#1a1a2e' : '#f1f5f9'} roughness={0.8} />
      </mesh>

      {/* Grid lines */}
      <Grid
        position={[0, -0.05, 0]}
        args={[20, 16]}
        cellSize={1}
        cellThickness={0.4}
        cellColor={isDark ? '#2d2d3f' : '#cbd5e1'}
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor={isDark ? '#3f3f5f' : '#94a3b8'}
        fadeDistance={30}
        fadeStrength={1}
        infiniteGrid={false}
      />

      {/* Zones */}
      {zones.map((zone) => {
        const zoneAssignments = assignments.filter((a) =>
          zone.skills.some((skill) =>
            a.shift?.requiredSkill?.name?.toLowerCase().includes(skill.toLowerCase())
          )
        );
        return (
          <FloorZone
            key={zone.id}
            zone={zone}
            assignments={zoneAssignments}
            selected={selectedZone?.id === zone.id}
            isDark={isDark}
            onClick={() => onSelectZone(selectedZone?.id === zone.id ? null : zone)}
          />
        );
      })}

      {/* Click-away to deselect */}
      <mesh
        position={[0, -0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => onSelectZone(null)}
      >
        <planeGeometry args={[20, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export function FloorPlanScene({ locationId, assignments, zones: zoneProp }: FloorPlanProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedZone, setSelectedZone] = useState<ZoneConfig | null>(null);
  // Use zones from API when available, fall back to hardcoded defaults
  const zones = zoneProp ?? ZONES;

  const selectedAssignments = selectedZone
    ? assignments.filter((a) =>
        selectedZone.skills.some((skill) =>
          a.shift?.requiredSkill?.name?.toLowerCase().includes(skill.toLowerCase())
        )
      )
    : [];

  return (
    <div className="relative w-full h-full flex">
      <div className="flex-1 h-full">
        <Canvas
          shadows
          gl={{ antialias: true }}
          style={{ background: isDark ? '#0f0f1a' : '#f8fafc' }}
        >
          <Scene
            assignments={assignments}
            selectedZone={selectedZone}
            onSelectZone={setSelectedZone}
            isDark={isDark}
            zones={zones}
          />
        </Canvas>
      </div>

      <ZoneDetailPanel
        zone={selectedZone}
        assignments={selectedAssignments}
        onClose={() => setSelectedZone(null)}
      />
    </div>
  );
}
