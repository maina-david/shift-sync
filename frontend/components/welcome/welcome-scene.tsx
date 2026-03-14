'use client';

// Loaded via dynamic({ ssr: false }) in app/page.tsx — safe to import R3F here.

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Bvh, AdaptiveDpr, Html, useProgress } from '@react-three/drei';
import {
  EffectComposer, Bloom, Vignette, SMAA,
  DepthOfField, ToneMapping, N8AO,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useTheme } from 'next-themes';

import { getPalette } from './scene-config';
import { Room }       from './scene-room';
import { Lighting }   from './scene-lighting';
import { ModelScene } from './scene-models';

// ── Loading indicator (shown inside canvas while assets resolve) ──────────────

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="text-white/60 text-xs font-medium tracking-widest uppercase">
        {Math.round(progress)} %
      </div>
    </Html>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function Scene({ isDark }: { isDark: boolean }) {
  const p = getPalette(isDark);
  return (
    <>
      {/* Environment: floor, ocean/sky, parapet, pergola */}
      <Room p={p} isDark={isDark} />
      {/* Lighting: sun, sky fill, candle point lights */}
      <Lighting p={p} isDark={isDark} />
      {/*
       * Model-based furniture + plants.
       * Falls back to procedural TableGroup/Decor while models are absent.
       * Once .glb files are in /public/models/, ModelScene takes over entirely.
       */}
      <ModelScene p={p} isDark={isDark} />
    </>
  );
}

// ── Canvas ────────────────────────────────────────────────────────────────────

export function WelcomeCanvas() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const p      = getPalette(isDark);

  return (
    <Canvas
      camera={{ position: [3, 1.9, 4.2], fov: 62 }}
      shadows
      gl={{
        antialias: false,           // SMAA handles AA — disable native for perf
        toneMappingExposure: isDark ? 1.4 : 1.1,
        powerPreference: 'high-performance',
        stencil: false,             // no stencil buffer needed
      }}
    >
      {/* Auto-reduce pixel ratio under GPU load, restore when idle */}
      <AdaptiveDpr pixelated />

      <color attach="background" args={[p.bg]} />
      <fog attach="fog" args={[p.fog, 26, 55]} />

      {/*
       * Suspense is required by the docs for ALL async R3F resources:
       *   - Environment   : fetches an HDRI file
       *   - MeshTransmissionMaterial : compiles async shaders
       *   - SMAA          : loads edge-detection kernel textures
       *   - useGLTF       : fetches .glb files (when models are added)
       * Loader renders inside the canvas so the 3-D background is never blank.
       */}
      <Suspense fallback={<Loader />}>
        <ambientLight intensity={isDark ? 0.06 : 0.38} />
        <Environment preset={isDark ? 'night' : 'sunset'} background={false} />

        <ContactShadows
          position={[0, 0.01, -0.75]}
          opacity={isDark ? 0.65 : 0.28}
          scale={20}
          blur={2.5}
          far={5}
          color={isDark ? '#0a0806' : '#8a7060'}
        />

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.10}
          enableZoom={false}
          enablePan={false}
          enableRotate
          rotateSpeed={0.55}
          minPolarAngle={Math.PI / 2 - 0.28}
          maxPolarAngle={Math.PI / 2 + 0.12}
          target={[0, 1.3, -2.0]}
        />

        {/* BVH spatial acceleration — faster raycasting over all scene meshes */}
        <Bvh>
          <Scene isDark={isDark} />
        </Bvh>

        {/*
         * Post-processing stack — applied in order:
         *   1. N8AO   — neural ambient occlusion
         *   2. SMAA   — high-quality anti-aliasing (async — needs Suspense)
         *   3. DOF    — depth-of-field
         *   4. Bloom  — selective glow (threshold=1, only toneMapped=false emissives)
         *   5. ToneMapping — ACES filmic
         *   6. Vignette — edge darkening
         */}
        <EffectComposer multisampling={0}>
          <N8AO
            aoRadius={2.5}
            distanceFalloff={1.2}
            intensity={isDark ? 2.2 : 1.6}
            quality="ultra"
            halfRes
          />
          <SMAA />
          <DepthOfField
            worldFocusDistance={9.0}
            worldFocusRange={5.5}
            bokehScale={isDark ? 2.0 : 1.4}
          />
          <Bloom
            luminanceThreshold={1}
            luminanceSmoothing={0.82}
            intensity={isDark ? 1.2 : 0.50}
            mipmapBlur
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.20} darkness={isDark ? 0.72 : 0.28} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
