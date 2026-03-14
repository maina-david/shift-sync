'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls, Environment, ContactShadows,
  Bvh, AdaptiveDpr, Html, useProgress,
  useGLTF, MeshTransmissionMaterial, MeshReflectorMaterial,
} from '@react-three/drei';
import {
  EffectComposer, Bloom, Vignette, SMAA,
  DepthOfField, ToneMapping, N8AO,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useTheme } from 'next-themes';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';
import { getPalette } from './scene-config';
import type { Palette } from './scene-config';
import {
  EnhancedBarCounter, CocktailShaker, IceBucket,
  type BottleDef,
} from './scene-bar';

// ── Model paths ────────────────────────────────────────────────────────────────

const MODELS = {
  chair:         '/models/chair.glb',
  table:         '/models/table.glb',
  glass:         '/models/wine-glass.glb',
  plant:         '/models/tropical-plant.glb',
  column:        '/models/column.glb',
  barStool:      '/models/bar-stool.glb',
  lantern:       '/models/lantern.glb',
  cocktailGlass: '/models/cocktail-glass.glb',
  hangingPlant:  '/models/hanging-plant-c.glb',
} as const;

Object.values(MODELS).forEach((path) => useGLTF.preload(path));

// ── GLTF typedefs ─────────────────────────────────────────────────────────────

type ChairGLTF = GLTF & {
  nodes: {
    SheenChair_fabric: THREE.Mesh;
    SheenChair_wood:   THREE.Mesh;
    SheenChair_metal:  THREE.Mesh;
    SheenChair_label:  THREE.Mesh;
  };
  materials: {
    'fabric Mystere Mango Velvet': THREE.MeshStandardMaterial;
    'wood Brown':                   THREE.MeshStandardMaterial;
    metal:                          THREE.MeshStandardMaterial;
    label:                          THREE.MeshStandardMaterial;
  };
};

type TableGLTF = GLTF & {
  nodes:     { Table:      THREE.Mesh };
  materials: { Material:   THREE.MeshStandardMaterial };
};

type GlassGLTF = GLTF & {
  nodes:     { wine_glass: THREE.Mesh };
  materials: { Material:   THREE.MeshStandardMaterial };
};

type ColumnGLTF = GLTF & {
  nodes: { Column2_1: THREE.Mesh; Column2_2: THREE.Mesh };
  materials: { Grey_Floor: THREE.MeshStandardMaterial; DarkGrey_Floor: THREE.MeshStandardMaterial };
};

type PlantGLTF = GLTF & {
  nodes: { Houseplant_7_1: THREE.Mesh; Houseplant_7_2: THREE.Mesh; Houseplant_7_3: THREE.Mesh };
  materials: { Black: THREE.MeshStandardMaterial; Brown: THREE.MeshStandardMaterial; Plant_Green: THREE.MeshStandardMaterial };
};

type BarStoolGLTF = GLTF & {
  nodes: { stoolBar_2: THREE.Mesh; stoolBar_2_1: THREE.Mesh; stoolBar_3: THREE.Mesh; stoolBar_3_1: THREE.Mesh };
  materials: { wood: THREE.MeshStandardMaterial; carpet: THREE.MeshStandardMaterial };
};

type LanternGLTF = GLTF & {
  nodes:     { lantern_hanging: THREE.Mesh };
  materials: { HalloweenBits:   THREE.MeshStandardMaterial };
};

type CocktailGlassGLTF = GLTF & {
  nodes:     { sercups_cocktail_glass_Cylinder104: THREE.Mesh };
  materials: { 'Solid_-_25%.036': THREE.MeshStandardMaterial };
};

type HangingPlantGLTF = GLTF & {
  nodes:     { pothos_plant_medium_potted: THREE.Mesh };
  materials: { tiny_treats_1: THREE.MeshStandardMaterial };
};

// ── GLTF model components ─────────────────────────────────────────────────────

function ChairModel({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const { nodes, materials } = useGLTF(MODELS.chair) as unknown as ChairGLTF;
  return (
    <group position={position} rotation={[0, rotationY, 0]} dispose={null}>
      <mesh castShadow receiveShadow geometry={nodes.SheenChair_fabric.geometry} material={materials['fabric Mystere Mango Velvet']} />
      <mesh castShadow receiveShadow geometry={nodes.SheenChair_wood.geometry}   material={materials['wood Brown']} />
      <mesh castShadow receiveShadow geometry={nodes.SheenChair_metal.geometry}  material={materials.metal} />
      <mesh geometry={nodes.SheenChair_label.geometry} material={materials.label} position={[-0.001, 0.236, 0.06]} rotation={[-0.087, 0, 0]} />
    </group>
  );
}

function TableModel({ position }: { position: [number, number, number] }) {
  const { nodes, materials } = useGLTF(MODELS.table) as unknown as TableGLTF;
  return (
    <group position={position} dispose={null}>
      <mesh castShadow receiveShadow geometry={nodes.Table.geometry} material={materials.Material} scale={100} />
    </group>
  );
}

function WineGlassModel({ position }: { position: [number, number, number] }) {
  const { nodes } = useGLTF(MODELS.glass) as unknown as GlassGLTF;
  const geo = nodes.wine_glass.geometry;
  const yFloor = useMemo(() => {
    geo.computeBoundingBox();
    return -(geo.boundingBox?.min.y ?? 0) * 100;
  }, [geo]);
  return (
    <group position={position} dispose={null}>
      <mesh castShadow geometry={geo} scale={100} position={[0, yFloor, 0]}>
        <MeshTransmissionMaterial transmission={1} thickness={0.3} roughness={0} ior={1.52} chromaticAberration={0.025} backside samples={4} resolution={256} color="#d8f2ff" />
      </mesh>
    </group>
  );
}

function ColumnModel({ position, p }: { position: [number, number, number]; p: Palette }) {
  const { nodes, materials } = useGLTF(MODELS.column) as unknown as ColumnGLTF;
  const mat = useMemo(() => {
    const m = materials.Grey_Floor.clone();
    m.color.set(p.wall); m.roughness = 0.44; m.metalness = 0.01;
    return m;
  }, [materials.Grey_Floor, p.wall]);
  return (
    <group position={position} dispose={null}>
      <group rotation={[-Math.PI / 2, 0, 0]} scale={100}>
        <mesh castShadow receiveShadow geometry={nodes.Column2_1.geometry} material={mat} />
        <mesh castShadow receiveShadow geometry={nodes.Column2_2.geometry} material={mat} />
      </group>
    </group>
  );
}

function TropicalPlantModel({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const { nodes, materials } = useGLTF(MODELS.plant) as unknown as PlantGLTF;
  return (
    <group position={position} scale={scale} dispose={null}>
      <group rotation={[-Math.PI / 2, 0, 0]} scale={100}>
        <mesh castShadow receiveShadow geometry={nodes.Houseplant_7_1.geometry} material={materials.Black} />
        <mesh castShadow receiveShadow geometry={nodes.Houseplant_7_2.geometry} material={materials.Brown} />
        <mesh castShadow receiveShadow geometry={nodes.Houseplant_7_3.geometry} material={materials.Plant_Green} />
      </group>
    </group>
  );
}

function BarStoolModel({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const { nodes, materials } = useGLTF(MODELS.barStool) as unknown as BarStoolGLTF;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={2.0} dispose={null}>
      <mesh castShadow receiveShadow geometry={nodes.stoolBar_2.geometry}   material={materials.wood} />
      <mesh castShadow receiveShadow geometry={nodes.stoolBar_2_1.geometry} material={materials.carpet} />
      <mesh castShadow receiveShadow geometry={nodes.stoolBar_3.geometry}   material={materials.carpet} />
      <mesh castShadow receiveShadow geometry={nodes.stoolBar_3_1.geometry} material={materials.wood} />
    </group>
  );
}

function LanternModel({ position }: { position: [number, number, number] }) {
  const { nodes, materials } = useGLTF(MODELS.lantern) as unknown as LanternGLTF;
  return (
    <group position={position} scale={18} dispose={null}>
      <mesh castShadow geometry={nodes.lantern_hanging.geometry} material={materials.HalloweenBits} />
    </group>
  );
}

function CocktailGlassModel({ position }: { position: [number, number, number] }) {
  const { nodes } = useGLTF(MODELS.cocktailGlass) as unknown as CocktailGlassGLTF;
  const geo = nodes.sercups_cocktail_glass_Cylinder104.geometry;
  const yFloor = useMemo(() => {
    geo.computeBoundingBox();
    return -(geo.boundingBox?.min.y ?? 0) * 0.04;
  }, [geo]);
  return (
    <group position={position} dispose={null}>
      <mesh castShadow geometry={geo} scale={0.04} position={[0, yFloor, 0]}>
        <MeshTransmissionMaterial transmission={1} thickness={0.25} roughness={0} ior={1.52} chromaticAberration={0.02} backside samples={4} resolution={256} color="#e8f4ff" />
      </mesh>
    </group>
  );
}

function HangingPlantModel({ position, scale = 60 }: { position: [number, number, number]; scale?: number }) {
  const { nodes, materials } = useGLTF(MODELS.hangingPlant) as unknown as HangingPlantGLTF;
  return (
    <group position={position} dispose={null}>
      <mesh castShadow receiveShadow geometry={nodes.pothos_plant_medium_potted.geometry} material={materials.tiny_treats_1} scale={scale} />
    </group>
  );
}

function HangingPlant({ x, z, hangY = 2.2, scale = 60 }: { x: number; z: number; hangY?: number; scale?: number }) {
  const ceilingY = 3.6;
  const ropeLen  = ceilingY - hangY;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, hangY + ropeLen / 2, 0]}>
        <cylinderGeometry args={[0.007, 0.007, ropeLen, 4]} />
        <meshStandardMaterial color="#7a5c3a" roughness={0.95} />
      </mesh>
      <HangingPlantModel position={[0, hangY, 0]} scale={scale} />
    </group>
  );
}

// ── Interior room walls & ceiling ─────────────────────────────────────────────

function InteriorRoom({ p, isDark }: { p: Palette; isDark: boolean }) {
  const panelColor   = isDark ? '#221a0e' : '#e8dfc8';
  const moldingColor = isDark ? '#3a2c18' : '#f0e8d4';

  return (
    <group>
      <mesh receiveShadow position={[-5.4, 2.2, 2.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[14, 4.4]} />
        <meshStandardMaterial color={isDark ? '#1e1810' : '#f0ece2'} roughness={0.88} metalness={0.01} />
      </mesh>
      <mesh receiveShadow position={[5.4, 2.2, 2.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[14, 4.4]} />
        <meshStandardMaterial color={isDark ? '#1e1810' : '#f0ece2'} roughness={0.88} metalness={0.01} />
      </mesh>
      <mesh receiveShadow position={[0, 2.2, -4.5]}>
        <planeGeometry args={[12, 4.4]} />
        <meshStandardMaterial color={isDark ? '#1e1810' : '#f0ece2'} roughness={0.88} metalness={0.01} />
      </mesh>

      {/* Wainscoting — left wall */}
      {([-2.5, 0, 2.5] as const).map((z, i) => (
        <group key={i}>
          <mesh position={[-5.38, 0.70, z]}>
            <boxGeometry args={[0.012, 1.05, 1.65]} />
            <meshStandardMaterial color={panelColor} roughness={0.70} />
          </mesh>
          <mesh position={[-5.37, 1.25, z]}>
            <boxGeometry args={[0.014, 0.018, 1.67]} />
            <meshStandardMaterial color={moldingColor} roughness={0.55} />
          </mesh>
        </group>
      ))}
      {/* Wainscoting — right wall */}
      {([-2.5, 0, 2.5] as const).map((z, i) => (
        <group key={i}>
          <mesh position={[5.38, 0.70, z]}>
            <boxGeometry args={[0.012, 1.05, 1.65]} />
            <meshStandardMaterial color={panelColor} roughness={0.70} />
          </mesh>
          <mesh position={[5.37, 1.25, z]}>
            <boxGeometry args={[0.014, 0.018, 1.67]} />
            <meshStandardMaterial color={moldingColor} roughness={0.55} />
          </mesh>
        </group>
      ))}

      {/* Chair rails */}
      <mesh position={[-5.37, 1.22, 2.0]}>
        <boxGeometry args={[0.016, 0.060, 14]} />
        <meshStandardMaterial color={moldingColor} roughness={0.50} />
      </mesh>
      <mesh position={[5.37, 1.22, 2.0]}>
        <boxGeometry args={[0.016, 0.060, 14]} />
        <meshStandardMaterial color={moldingColor} roughness={0.50} />
      </mesh>

      {/* Wall sconces — left */}
      {([0.5, 2.8] as const).map((z, i) => (
        <group key={i} position={[-5.30, 1.85, z]}>
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <coneGeometry args={[0.065, 0.14, 18, 1, true]} />
            <meshStandardMaterial color={isDark ? '#1a1a1a' : '#2a2420'} roughness={0.42} metalness={0.38} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <coneGeometry args={[0.060, 0.135, 18, 1, true]} />
            <meshStandardMaterial color={isDark ? '#ff9428' : '#ffc850'} emissive={isDark ? '#ff6810' : '#ffaa30'} emissiveIntensity={isDark ? 1.8 : 0.9} side={THREE.BackSide} />
          </mesh>
          <pointLight intensity={isDark ? 1.4 : 0.5} color={isDark ? '#ffaa44' : '#ffe0a0'} distance={4.5} decay={2} />
        </group>
      ))}
      {/* Wall sconces — right */}
      {([0.5, 2.8] as const).map((z, i) => (
        <group key={i} position={[5.30, 1.85, z]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <coneGeometry args={[0.065, 0.14, 18, 1, true]} />
            <meshStandardMaterial color={isDark ? '#1a1a1a' : '#2a2420'} roughness={0.42} metalness={0.38} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <coneGeometry args={[0.060, 0.135, 18, 1, true]} />
            <meshStandardMaterial color={isDark ? '#ff9428' : '#ffc850'} emissive={isDark ? '#ff6810' : '#ffaa30'} emissiveIntensity={isDark ? 1.8 : 0.9} side={THREE.BackSide} />
          </mesh>
          <pointLight intensity={isDark ? 1.4 : 0.5} color={isDark ? '#ffaa44' : '#ffe0a0'} distance={4.5} decay={2} />
        </group>
      ))}

      {/* Ceiling */}
      <mesh receiveShadow position={[0, 4.0, 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color={isDark ? '#0e0c0a' : '#f5f2ec'} roughness={0.92} />
      </mesh>
      {/* Ceiling beams */}
      {([-2.5, 0, 2.5] as const).map((x, i) => (
        <mesh key={i} position={[x, 3.80, 2.5]} castShadow>
          <boxGeometry args={[0.18, 0.26, 12]} />
          <meshStandardMaterial color={isDark ? '#3a2c18' : '#a07840'} roughness={0.70} metalness={0.02} />
        </mesh>
      ))}
      <mesh position={[0, 3.80, -0.5]} castShadow>
        <boxGeometry args={[6.5, 0.18, 0.18]} />
        <meshStandardMaterial color={isDark ? '#3a2c18' : '#a07840'} roughness={0.70} metalness={0.02} />
      </mesh>
      <mesh position={[0, 3.80, 4.5]} castShadow>
        <boxGeometry args={[6.5, 0.18, 0.18]} />
        <meshStandardMaterial color={isDark ? '#3a2c18' : '#a07840'} roughness={0.70} metalness={0.02} />
      </mesh>
    </group>
  );
}

// ── Shelf bottle layouts ───────────────────────────────────────────────────────

const LOGIN_BOTTOM: BottleDef[] = [
  { x: -1.38, type: 'whiskey', color: '#c87820' },
  { x: -0.82, type: 'whiskey', color: '#8B3a05' },
  { x: -0.24, type: 'rum' },
  { x:  0.34, type: 'tequila' },
  { x:  0.92, type: 'whiskey', color: '#9a4808' },
  { x:  1.43, type: 'gin',     color: '#bcd8ea' },
];

const LOGIN_MID: BottleDef[] = [
  { x: -1.28, type: 'wine', color: '#1a3d12', label: '#6B0000' },
  { x: -0.68, type: 'wine', color: '#1e4818', label: '#1a3d60' },
  { x: -0.05, type: 'wine', color: '#e8e2d4', label: '#c0a030' },
  { x:  0.58, type: 'wine', color: '#1a2d10', label: '#3d1a60' },
  { x:  1.18, type: 'gin',  color: '#a8c8e0' },
];

const LOGIN_TOP: BottleDef[] = [
  { x: -1.00, type: 'whiskey', color: '#7a4818' },
  { x: -0.40, type: 'vodka' },
  { x:  0.18, type: 'whiskey', color: '#c07818' },
  { x:  0.78, type: 'rum' },
  { x:  1.30, type: 'gin',     color: '#c8dde8' },
];

// ── Main scene content ────────────────────────────────────────────────────────

function LoginSceneContent({ p, isDark }: { p: Palette; isDark: boolean }) {
  const BZ      = 4.5;
  const STOOL_Z = 3.55;
  const TOP_Y   = 0.965;

  const { nodes: tNodes } = useGLTF(MODELS.table) as unknown as TableGLTF;
  const tableTopY = useMemo(() => {
    const geo = tNodes.Table.geometry;
    geo.computeBoundingBox();
    return (geo.boundingBox?.max.y ?? 0.0075) * 100;
  }, [tNodes.Table.geometry]);

  return (
    <>
      <InteriorRoom p={p} isDark={isDark} />

      {/* Stone tile floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2.0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <MeshReflectorMaterial
          color={p.floor}
          roughness={0.72}
          metalness={0.02}
          mirror={0.10}
          blur={[220, 70]}
          resolution={512}
          mixBlur={7}
          mixStrength={isDark ? 0.30 : 0.12}
          mixContrast={1.06}
          depthScale={0.22}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.0}
          reflectorOffset={0.01}
        />
      </mesh>

      {/* Tile grout lines */}
      {([-1.5, 0, 1.5] as const).map((gx, i) => (
        <mesh key={`gx${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[gx, 0.002, 2.0]}>
          <planeGeometry args={[0.018, 12]} />
          <meshStandardMaterial color={p.floorLine} roughness={0.92} />
        </mesh>
      ))}
      {([-1.5, 0, 1.5, 3, 4.5] as const).map((gz, i) => (
        <mesh key={`gz${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, gz]}>
          <planeGeometry args={[12, 0.018]} />
          <meshStandardMaterial color={p.floorLine} roughness={0.92} />
        </mesh>
      ))}

      {/* Enhanced bar counter */}
      <EnhancedBarCounter
        p={p} isDark={isDark} BZ={BZ} W={3.6}
        bottomRow={LOGIN_BOTTOM}
        midRow={LOGIN_MID}
        topRow={LOGIN_TOP}
        topY={TOP_Y}
        pendantX={[-1.18, 0, 1.18]}
        renderExtras={() => (
          <>
            <CocktailGlassModel position={[ 0.02, TOP_Y + 0.010, BZ - 0.11]} />
            <CocktailGlassModel position={[ 0.32, TOP_Y + 0.010, BZ - 0.11]} />
          </>
        )}
      />

      {/* Bar stools */}
      <BarStoolModel position={[-1.10, 0, STOOL_Z]} rotationY={Math.PI} />
      <BarStoolModel position={[ 0.00, 0, STOOL_Z]} rotationY={Math.PI} />
      <BarStoolModel position={[ 1.10, 0, STOOL_Z]} rotationY={Math.PI} />

      {/* Foreground table */}
      <TableModel position={[0, 0, 0.8]} />
      <ChairModel position={[ 0, 0,  0.8 - 0.85]} rotationY={0} />
      <ChairModel position={[ 0, 0,  0.8 + 0.85]} rotationY={Math.PI} />
      <WineGlassModel position={[-0.15, tableTopY, 0.8]} />
      <WineGlassModel position={[ 0.15, tableTopY, 0.8]} />

      {/* Columns */}
      <ColumnModel position={[-3.2, 0, 3.5]} p={p} />
      <ColumnModel position={[ 3.2, 0, 3.5]} p={p} />

      {/* Lanterns */}
      <LanternModel position={[-2.0, 3.0, 3.0]} />
      <LanternModel position={[ 2.0, 3.0, 3.0]} />

      {/* Hanging plants */}
      <HangingPlant x={-1.0} z={2.8} hangY={1.8} scale={55} />
      <HangingPlant x={ 1.0} z={2.8} hangY={2.0} scale={60} />

      {/* Tropical plants */}
      <TropicalPlantModel position={[-4.4, 0, 1.2]} scale={1.10} />
      <TropicalPlantModel position={[ 4.4, 0, 1.2]} scale={1.10} />
      <TropicalPlantModel position={[-4.2, 0, 4.2]} scale={0.88} />
      <TropicalPlantModel position={[ 4.2, 0, 4.2]} scale={0.88} />

      {isDark && (
        <>
          <pointLight position={[0, 0.85, 0.8]}  intensity={1.5} color="#ffb040" distance={3.5} decay={2} />
          <pointLight position={[0, 4.0,  2.0]}  intensity={0.4} color="#203060" distance={14}  decay={2} />
        </>
      )}
    </>
  );
}

// ── Loader ────────────────────────────────────────────────────────────────────

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="text-white/60 text-xs font-medium tracking-widest uppercase">
        {Math.round(progress)}%
      </div>
    </Html>
  );
}

// ── LoginCanvas ───────────────────────────────────────────────────────────────

export function LoginCanvas() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const p      = getPalette(isDark);

  return (
    <Canvas
      camera={{ position: [0, 1.65, -1.2], fov: 52 }}
      shadows
      gl={{
        antialias: false,
        toneMappingExposure: isDark ? 1.6 : 1.15,
        powerPreference: 'high-performance',
        stencil: false,
      }}
    >
      <AdaptiveDpr pixelated />
      <color attach="background" args={[p.bg]} />
      <fog attach="fog" args={[p.fog, 20, 34]} />

      <Suspense fallback={<Loader />}>
        <ambientLight intensity={isDark ? 0.04 : 0.30} />
        <Environment preset={isDark ? 'night' : 'sunset'} background={false} />

        <directionalLight
          position={[3, 7, -4]}
          intensity={isDark ? 0.22 : 2.2}
          color={isDark ? '#c4a060' : '#fff8e8'}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={1}
          shadow-camera-far={28}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <directionalLight position={[0, 6, 2]}  intensity={isDark ? 0.04 : 0.55} color={isDark ? '#1a2a50' : '#a8d8f8'} />
        <directionalLight position={[-4, 3, 1]} intensity={isDark ? 0.04 : 0.35} color={isDark ? '#402010' : '#ffe4b8'} />

        <ContactShadows
          position={[0, 0.01, 2.0]}
          opacity={isDark ? 0.75 : 0.30}
          scale={16}
          blur={2.8}
          far={6}
          color={isDark ? '#0a0806' : '#8a7060'}
        />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.05}
          enableZoom={false}
          enablePan={false}
          enableRotate
          rotateSpeed={0.42}
          minPolarAngle={Math.PI / 2 - 0.24}
          maxPolarAngle={Math.PI / 2 + 0.10}
          target={[0, 1.15, 3.8]}
        />

        <Bvh>
          <LoginSceneContent p={p} isDark={isDark} />
        </Bvh>

        <EffectComposer multisampling={0}>
          <N8AO aoRadius={2.2} distanceFalloff={1.3} intensity={isDark ? 2.4 : 1.6} quality="ultra" halfRes />
          <SMAA />
          <DepthOfField worldFocusDistance={5.8} worldFocusRange={5.0} bokehScale={isDark ? 2.8 : 2.0} />
          <Bloom luminanceThreshold={0.90} luminanceSmoothing={0.85} intensity={isDark ? 1.8 : 0.55} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.22} darkness={isDark ? 0.86 : 0.40} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
