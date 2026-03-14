'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial, Sky } from '@react-three/drei';
import type { Mesh, MeshStandardMaterial as ThreeStdMat } from 'three';
import type { Palette } from './scene-config';

// ── Animated beach + ocean exterior ──────────────────────────────────────────

function BeachExterior({ isDark }: { isDark: boolean }) {
  const oceanRef = useRef<Mesh>(null!);
  const glintRef = useRef<Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (oceanRef.current) {
      const m = oceanRef.current.material as ThreeStdMat;
      m.emissiveIntensity = (isDark ? 0.28 : 0.48) + Math.sin(t * 1.1) * 0.10;
      m.metalness         = 0.58 + Math.sin(t * 0.7 + 1.2) * 0.10;
    }
    if (glintRef.current) {
      const m = glintRef.current.material as ThreeStdMat;
      m.emissiveIntensity = (isDark ? 0.12 : 0.75) + Math.sin(t * 2.4) * 0.20;
      m.opacity           = (isDark ? 0.30 : 0.60) + Math.sin(t * 1.8 + 0.5) * 0.14;
    }
  });

  return (
    <group>
      {isDark ? (
        <mesh position={[0, 0, -30]}>
          <planeGeometry args={[80, 40]} />
          <meshStandardMaterial color="#07111e" emissive="#1a2a4a" emissiveIntensity={0.5} roughness={1} />
        </mesh>
      ) : (
        <Sky
          distance={450000}
          sunPosition={[2, 0.30, -1]}
          turbidity={3.5}
          rayleigh={0.9}
          mieCoefficient={0.006}
          mieDirectionalG={0.75}
        />
      )}

      {isDark && (
        /* emissiveIntensity=2.5 + toneMapped=false → luminance > 1 → blooms */
        <mesh position={[4.5, 6, -20]}>
          <sphereGeometry args={[0.36, 16, 16]} />
          <meshStandardMaterial
            color="#c8d8f8"
            emissive="#7080c0"
            emissiveIntensity={2.5}
            roughness={0}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Ocean — animated shimmer */}
      <mesh ref={oceanRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.28, -14]}>
        <planeGeometry args={[60, 18]} />
        <meshStandardMaterial
          color={isDark ? '#070e1a' : '#1a7aaa'}
          emissive={isDark ? '#0a2040' : '#2090c0'}
          emissiveIntensity={isDark ? 0.28 : 0.48}
          roughness={0.05}
          metalness={0.58}
        />
      </mesh>

      {/* Sun-path glint on water */}
      <mesh ref={glintRef} position={[4.5, 0.30, -12]}>
        <boxGeometry args={[2.0, 0.01, 14]} />
        <meshStandardMaterial
          color={isDark ? '#304880' : '#fff8c0'}
          emissive={isDark ? '#304880' : '#fff8c0'}
          emissiveIntensity={isDark ? 0.12 : 0.75}
          roughness={0}
          metalness={0.90}
          transparent
          opacity={isDark ? 0.30 : 0.60}
        />
      </mesh>

      {/* Sandy beach */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -8.5]}>
        <planeGeometry args={[60, 4.0]} />
        <meshStandardMaterial color={isDark ? '#161208' : '#d8c898'} roughness={0.95} />
      </mesh>

      {/* Distant sailboats */}
      {([[9, -18], [-8, -20]] as [number, number][]).map(([bx, bz], i) => (
        <group key={i} position={[bx, 0.9, bz]} scale={1.1}>
          <mesh>
            <boxGeometry args={[0.80, 0.13, 0.22]} />
            <meshStandardMaterial color="#e8dfc8" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.010, 0.010, 1.16, 5]} />
            <meshStandardMaterial color="#c8b888" roughness={0.72} />
          </mesh>
          <mesh position={[0.06, 0.58, 0]}>
            <boxGeometry args={[0.012, 0.90, 0.52]} />
            <meshStandardMaterial color="#f4f0e8" roughness={0.85} side={2} />
          </mesh>
        </group>
      ))}

      {/* Ocean light washing into the restaurant */}
      <pointLight
        position={[0, 2.5, -6.5]}
        intensity={isDark ? 0.4 : 3.0}
        color={isDark ? '#304880' : '#80d0f8'}
        distance={24}
        decay={2}
      />
    </group>
  );
}

// ── Wooden pergola — dense primary beams + secondary battens ──────────────────

function Pergola({ p }: { p: Palette }) {
  const Y      = 3.74;
  const mainZ  = [-4.2, -1.6, 1.0, 3.6];
  const crossX = [-4.5, -2.70, -0.90, 0.90, 2.70, 4.5];

  const slatX: number[] = [];
  for (let sx = -4.5; sx <= 4.51; sx += 0.55) {
    const rounded = Math.round(sx * 100) / 100;
    if (!crossX.some(cx => Math.abs(cx - rounded) < 0.18)) {
      slatX.push(rounded);
    }
  }

  return (
    <group>
      {mainZ.map((bz, i) => (
        <mesh key={`m${i}`} castShadow position={[0, Y, bz]}>
          <boxGeometry args={[11.0, 0.22, 0.28]} />
          <meshStandardMaterial color={p.beam} roughness={0.60} metalness={0.04} />
        </mesh>
      ))}
      {crossX.map((bx, i) => (
        <mesh key={`c${i}`} castShadow position={[bx, Y + 0.12, -0.30]}>
          <boxGeometry args={[0.22, 0.18, 11.5]} />
          <meshStandardMaterial color={p.beam} roughness={0.60} metalness={0.04} />
        </mesh>
      ))}
      {slatX.map((sx, i) => (
        <mesh key={`s${i}`} position={[sx, Y + 0.10, -0.30]}>
          <boxGeometry args={[0.10, 0.10, 11.5]} />
          <meshStandardMaterial color={p.beam} roughness={0.65} metalness={0.03} />
        </mesh>
      ))}
    </group>
  );
}

// ── Open-air room — floor, parapet, pergola, beach/sky only ──────────────────
// Columns, plants and palm trees are rendered by ModelScene (scene-models.tsx).

export function Room({ p, isDark }: { p: Palette; isDark: boolean }) {
  return (
    <>
      <BeachExterior isDark={isDark} />

      {/* Stone tile floor — cream / travertine with reflector */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.75]} receiveShadow>
        <planeGeometry args={[13, 14]} />
        <MeshReflectorMaterial
          color={p.floor}
          roughness={0.72}
          metalness={0.02}
          mirror={0.08}
          blur={[200, 60]}
          resolution={512}
          mixBlur={6}
          mixStrength={isDark ? 0.25 : 0.10}
          mixContrast={1.05}
          depthScale={0.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.0}
          reflectorOffset={0.01}
        />
      </mesh>

      {/* Tile grout lines */}
      {([-3, -1.5, 0, 1.5, 3] as const).map((gx, i) => (
        <mesh key={`gx${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[gx, 0.002, -0.75]}>
          <planeGeometry args={[0.018, 14]} />
          <meshStandardMaterial color={p.floorLine} roughness={0.9} />
        </mesh>
      ))}
      {([-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5] as const).map((gz, i) => (
        <mesh key={`gz${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, gz]}>
          <planeGeometry args={[13, 0.018]} />
          <meshStandardMaterial color={p.floorLine} roughness={0.9} />
        </mesh>
      ))}

      {/* Low ocean-facing parapet */}
      <mesh receiveShadow position={[0, 0.48, -6.9]}>
        <boxGeometry args={[12.0, 0.96, 0.18]} />
        <meshStandardMaterial color={p.wall} roughness={0.62} />
      </mesh>
      {/* Parapet cap rail */}
      <mesh position={[0, 0.97, -6.9]}>
        <boxGeometry args={[12.0, 0.06, 0.26]} />
        <meshStandardMaterial color={p.wainscot} roughness={0.45} metalness={0.08} />
      </mesh>

      {/* Pergola trellis overhead */}
      <Pergola p={p} />
    </>
  );
}
