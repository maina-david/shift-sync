'use client';

// This file is the ONLY one that imports from @react-three/fiber or @react-three/drei.
// It is always loaded via dynamic({ ssr: false }) to avoid SSR browser-API errors.

export { FloorPlanScene as FloorPlanCanvas } from './floor-plan-scene';
