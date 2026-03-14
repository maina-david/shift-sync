'use client';

import { useMemo } from 'react';
import { useGLTF, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { GLTF } from 'three-stdlib';
import type { Palette } from './scene-config';
import { CHAIR_ANGLES, TABLE_POSITIONS, COLUMN_POS } from './scene-config';
import {
  EnhancedBarCounter,
  type BottleDef,
} from './scene-bar';

const MODELS = {
  chair:         '/models/chair.glb',
  table:         '/models/table.glb',
  glass:         '/models/wine-glass.glb',
  plant:         '/models/tropical-plant.glb',
  palm:          '/models/palm-tree.glb',
  column:        '/models/column.glb',
  barStool:      '/models/bar-stool.glb',
  lantern:       '/models/lantern.glb',
  cocktailGlass: '/models/cocktail-glass.glb',
  fan:           '/models/ceiling-fan.glb',
  hangingPlant:  '/models/hanging-plant-c.glb',
} as const;

Object.values(MODELS).forEach(path => useGLTF.preload(path));

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
  materials: {
    Grey_Floor:     THREE.MeshStandardMaterial;
    DarkGrey_Floor: THREE.MeshStandardMaterial;
  };
};

type PalmGLTF = GLTF & {
  nodes: { PalmTree_1_1: THREE.Mesh; PalmTree_1_2: THREE.Mesh };
  materials: {
    PalmTree_Trunk:  THREE.MeshStandardMaterial;
    PalmTree_Leaves: THREE.MeshStandardMaterial;
  };
};

type PlantGLTF = GLTF & {
  nodes: {
    Houseplant_7_1: THREE.Mesh;
    Houseplant_7_2: THREE.Mesh;
    Houseplant_7_3: THREE.Mesh;
  };
  materials: {
    Black:       THREE.MeshStandardMaterial;
    Brown:       THREE.MeshStandardMaterial;
    Plant_Green: THREE.MeshStandardMaterial;
  };
};

type BarStoolGLTF = GLTF & {
  nodes: {
    stoolBar_2:   THREE.Mesh;
    stoolBar_2_1: THREE.Mesh;
    stoolBar_3:   THREE.Mesh;
    stoolBar_3_1: THREE.Mesh;
  };
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

type CeilingFanGLTF = GLTF & {
  nodes: {
    ceilingFan_2:   THREE.Mesh;
    ceilingFan_2_1: THREE.Mesh;
    ceilingFan_2_2: THREE.Mesh;
    ceilingFan_3:   THREE.Mesh;
    ceilingFan_3_1: THREE.Mesh;
    ceilingFan_3_2: THREE.Mesh;
  };
  materials: {
    metalLight: THREE.MeshStandardMaterial;
    lamp:       THREE.MeshStandardMaterial;
    wood:       THREE.MeshStandardMaterial;
  };
};

function ChairModel({ position, rotationY }: {
  position: [number, number, number]; rotationY: number;
}) {
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

function PalmTreeModel({ position, scale = 1, rotationY = 0 }: {
  position: [number, number, number]; scale?: number; rotationY?: number;
}) {
  const { nodes, materials } = useGLTF(MODELS.palm) as unknown as PalmGLTF;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale} dispose={null}>
      <group position={[-117.513, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={100}>
        <mesh castShadow geometry={nodes.PalmTree_1_1.geometry} material={materials.PalmTree_Trunk} />
        <mesh castShadow geometry={nodes.PalmTree_1_2.geometry} material={materials.PalmTree_Leaves} />
      </group>
    </group>
  );
}

function TropicalPlantModel({ position, scale = 1 }: {
  position: [number, number, number]; scale?: number;
}) {
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

function BarStoolModel({ position, rotationY = 0 }: {
  position: [number, number, number]; rotationY?: number;
}) {
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
        <MeshTransmissionMaterial transmission={1} thickness={0.3} roughness={0} ior={1.52} chromaticAberration={0.025} backside samples={4} resolution={256} color="#d8f2ff" />
      </mesh>
    </group>
  );
}

function HangingPlantModel({ position, scale = 60 }: {
  position: [number, number, number]; scale?: number;
}) {
  const { nodes, materials } = useGLTF(MODELS.hangingPlant) as unknown as HangingPlantGLTF;
  return (
    <group position={position} dispose={null}>
      <mesh castShadow receiveShadow geometry={nodes.pothos_plant_medium_potted.geometry} material={materials.tiny_treats_1} scale={scale} />
    </group>
  );
}

// Rope + plant suspended from the pergola (pergola Y = 3.74).
function HangingPlant({ x, z, hangY = 2.2, scale = 60 }: {
  x: number; z: number; hangY?: number; scale?: number;
}) {
  const ropeLen = 3.74 - hangY;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, hangY + ropeLen / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, ropeLen, 4]} />
        <meshStandardMaterial color="#7a5c3a" roughness={0.95} />
      </mesh>
      <HangingPlantModel position={[0, hangY, 0]} scale={scale} />
    </group>
  );
}

function CeilingFanModel({ position }: { position: [number, number, number] }) {
  const { nodes, materials } = useGLTF(MODELS.fan) as unknown as CeilingFanGLTF;
  return (
    <group position={position} scale={4} dispose={null}>
      <mesh castShadow geometry={nodes.ceilingFan_2.geometry}   material={materials.metalLight} />
      <mesh castShadow geometry={nodes.ceilingFan_2_1.geometry} material={materials.lamp} />
      <mesh castShadow geometry={nodes.ceilingFan_2_2.geometry} material={materials.wood} />
      <mesh castShadow geometry={nodes.ceilingFan_3.geometry}   material={materials.wood} />
      <mesh castShadow geometry={nodes.ceilingFan_3_1.geometry} material={materials.metalLight} />
      <mesh castShadow geometry={nodes.ceilingFan_3_2.geometry} material={materials.lamp} />
    </group>
  );
}

// ── Welcome bar shelf layouts (wider bar: W=4.0) ──────────────────────────────

const WELCOME_BOTTOM: BottleDef[] = [
  { x: -1.70, type: 'whiskey', color: '#c87820' },
  { x: -1.10, type: 'whiskey', color: '#8B3a05' },
  { x: -0.48, type: 'rum' },
  { x:  0.14, type: 'tequila' },
  { x:  0.76, type: 'whiskey', color: '#9a4808' },
  { x:  1.34, type: 'gin',     color: '#bcd8ea' },
  { x:  1.75, type: 'vodka' },
];

const WELCOME_MID: BottleDef[] = [
  { x: -1.62, type: 'wine', color: '#1a3d12', label: '#6B0000' },
  { x: -1.02, type: 'wine', color: '#1e4818', label: '#1a3d60' },
  { x: -0.38, type: 'wine', color: '#e8e2d4', label: '#c0a030' },
  { x:  0.26, type: 'wine', color: '#1a2d10', label: '#3d1a60' },
  { x:  0.86, type: 'gin',  color: '#a8c8e0' },
  { x:  1.48, type: 'rum' },
];

const WELCOME_TOP: BottleDef[] = [
  { x: -1.45, type: 'whiskey', color: '#7a4818' },
  { x: -0.85, type: 'vodka' },
  { x: -0.22, type: 'whiskey', color: '#c07818' },
  { x:  0.40, type: 'rum' },
  { x:  1.02, type: 'gin',     color: '#c8dde8' },
  { x:  1.56, type: 'tequila' },
];

function BarAreaModel({ p, isDark }: { p: Palette; isDark: boolean }) {
  const BZ      = 5.55;
  const STOOL_Z = 4.60;
  const TOP_Y   = 0.965;

  const stoolX = [-1.5, -0.5, 0.5, 1.5] as const;

  return (
    <>
      <EnhancedBarCounter
        p={p} isDark={isDark} BZ={BZ} W={4.0}
        shlZOffset={0.61}
        backZOffset={0.75}
        bottomRow={WELCOME_BOTTOM}
        midRow={WELCOME_MID}
        topRow={WELCOME_TOP}
        topY={TOP_Y}
        pendantX={[-1.50, 0, 1.50]}
        renderExtras={() => (
          <>
            <CocktailGlassModel position={[-0.10, TOP_Y + 0.010, BZ - 0.10]} />
            <CocktailGlassModel position={[ 0.24, TOP_Y + 0.010, BZ - 0.10]} />
            <CocktailGlassModel position={[ 0.58, TOP_Y + 0.010, BZ - 0.10]} />
          </>
        )}
      />

      {stoolX.map((sx, i) => (
        <BarStoolModel key={i} position={[sx, 0, STOOL_Z]} rotationY={Math.PI} />
      ))}
    </>
  );
}

function TableGroupModel({ x, z, p }: { x: number; z: number; p: Palette }) {
  const chairDist = 0.85;
  const { nodes: tNodes } = useGLTF(MODELS.table) as unknown as TableGLTF;
  const tableTopY = useMemo(() => {
    const geo = tNodes.Table.geometry;
    geo.computeBoundingBox();
    return (geo.boundingBox?.max.y ?? 0.0075) * 100;
  }, [tNodes.Table.geometry]);
  const settings: [number, number][] = [
    [ 0.00,  0.22], [ 0.22,  0.00], [ 0.00, -0.22], [-0.22,  0.00],
  ];
  return (
    <>
      <TableModel position={[x, 0, z]} />
      {CHAIR_ANGLES.map((angle, i) => (
        <ChairModel
          key={i}
          position={[x + Math.sin(angle) * chairDist, 0, z + Math.cos(angle) * chairDist]}
          rotationY={angle + Math.PI}
        />
      ))}
      {settings.map(([dx, dz], i) => (
        <WineGlassModel key={i} position={[x + dx + 0.15, tableTopY, z + dz - 0.04]} />
      ))}
    </>
  );
}

export function ModelScene({ p, isDark }: { p: Palette; isDark: boolean }) {
  return (
    <>
      {TABLE_POSITIONS.map(([x, z], i) => (
        <TableGroupModel key={i} x={x} z={z} p={p} />
      ))}

      {COLUMN_POS.map(([cx, cz], i) => (
        <ColumnModel key={i} position={[cx, 0, cz]} p={p} />
      ))}

      <BarAreaModel p={p} isDark={isDark} />

      <LanternModel position={[-3.5, 3.10, -2.5]} />
      <LanternModel position={[ 3.5, 3.10, -2.5]} />
      <LanternModel position={[-3.5, 3.10,  1.5]} />
      <LanternModel position={[ 3.5, 3.10,  1.5]} />
      <LanternModel position={[ 0.0, 3.10, -4.8]} />
      <LanternModel position={[ 0.0, 3.10,  3.5]} />

      <CeilingFanModel position={[-2.5, 3.74, -0.5]} />
      <CeilingFanModel position={[ 2.5, 3.74, -0.5]} />

      <HangingPlant x={-0.90} z={-4.2} hangY={2.0} />
      <HangingPlant x={ 0.90} z={-4.2} hangY={2.3} scale={50} />
      <HangingPlant x={-2.70} z={-1.6} hangY={2.1} scale={55} />
      <HangingPlant x={ 2.70} z={-1.6} hangY={2.4} />
      <HangingPlant x={-0.90} z={ 1.0} hangY={2.2} scale={50} />
      <HangingPlant x={ 0.90} z={ 1.0} hangY={1.9} scale={55} />
      <HangingPlant x={-2.70} z={ 3.6} hangY={2.1} />
      <HangingPlant x={ 2.70} z={ 3.6} hangY={2.3} scale={50} />

      <TropicalPlantModel position={[-5.2, 0, -4.5]} scale={1.20} />
      <TropicalPlantModel position={[ 5.2, 0, -4.5]} scale={1.20} />
      <TropicalPlantModel position={[-5.4, 0,  0.5]} />
      <TropicalPlantModel position={[ 5.4, 0,  0.5]} />
      <TropicalPlantModel position={[-5.0, 0,  4.8]} scale={0.90} />
      <TropicalPlantModel position={[ 5.0, 0,  4.8]} scale={0.90} />
      <TropicalPlantModel position={[ 0.0, 0, -6.4]} scale={1.10} />

      <TropicalPlantModel position={[-5.8, 0,  5.2]} scale={1.10} />
      <TropicalPlantModel position={[ 5.8, 0,  5.2]} scale={1.10} />
      <TropicalPlantModel position={[-5.6, 0,  2.8]} scale={0.90} />
      <TropicalPlantModel position={[ 5.6, 0,  2.8]} scale={0.90} />
      <TropicalPlantModel position={[-5.5, 0, -1.8]} scale={0.85} />
      <TropicalPlantModel position={[ 5.5, 0, -1.8]} scale={0.85} />

      <PalmTreeModel position={[-5.5, 0, -7.5]} scale={1.10} rotationY={ 0.30} />
      <PalmTreeModel position={[ 5.5, 0, -7.5]} scale={1.10} rotationY={-0.30} />
      <PalmTreeModel position={[-3.5, 0, -9.5]} scale={0.95} rotationY={ 0.15} />
      <PalmTreeModel position={[ 3.5, 0, -9.5]} scale={0.95} rotationY={-0.15} />
      <PalmTreeModel position={[-7.0, 0, -6.0]} scale={1.20} rotationY={ 0.36} />
      <PalmTreeModel position={[ 7.0, 0, -6.0]} scale={1.20} rotationY={-0.36} />
    </>
  );
}
