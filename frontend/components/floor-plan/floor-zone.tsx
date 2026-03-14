'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Mesh } from 'three';
import type { ZoneConfig } from './floor-plan-types';
import type { ShiftAssignment } from '@/lib/types';
import { getZoneColor } from './zone-config';

interface Props {
  zone: ZoneConfig;
  assignments: ShiftAssignment[];
  selected: boolean;
  isDark: boolean;
  onClick: () => void;
}

export function FloorZone({ zone, assignments, selected, isDark, onClick }: Props) {
  const meshRef = useRef<Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  const color = getZoneColor(zone, isDark, selected || hovered);
  const [w, d] = zone.size;

  useFrame(() => {
    if (meshRef.current) {
      const targetScale = hovered || selected ? 1.03 : 1;
      meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.12;
      meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.12;
    }
  });

  return (
    <group position={zone.position}>
      <mesh
        ref={meshRef}
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={[w, 0.12, d]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Zone label */}
      <Html
        position={[0, 0.25, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap select-none"
          style={{
            background: isDark ? 'rgba(15,15,20,0.75)' : 'rgba(255,255,255,0.75)',
            color: isDark ? '#e5e7eb' : '#111827',
            backdropFilter: 'blur(4px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          {zone.label}
        </div>
      </Html>

      {/* Staff chips */}
      {assignments.slice(0, 4).map((a, i) => {
        const col = i % 2 === 0 ? -0.8 : 0.8;
        const row = Math.floor(i / 2) * -1.1;
        return (
          <Html
            key={a.id}
            position={[col, 0.3, row]}
            center
            distanceFactor={10}
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="px-1.5 py-0.5 rounded-full text-[0.625rem] font-medium whitespace-nowrap select-none"
              style={{
                background: isDark ? 'rgba(30,30,40,0.85)' : 'rgba(255,255,255,0.88)',
                color: isDark ? '#d1d5db' : '#374151',
                backdropFilter: 'blur(4px)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              {a.staff.name.split(' ')[0]}
            </div>
          </Html>
        );
      })}
      {assignments.length > 4 && (
        <Html position={[0, 0.3, -1.1]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div
            className="px-1.5 py-0.5 rounded-full text-[0.625rem] font-medium whitespace-nowrap select-none"
            style={{
              background: isDark ? 'rgba(30,30,40,0.85)' : 'rgba(255,255,255,0.88)',
              color: isDark ? '#9ca3af' : '#6b7280',
              backdropFilter: 'blur(4px)',
            }}
          >
            +{assignments.length - 4} more
          </div>
        </Html>
      )}
    </group>
  );
}
