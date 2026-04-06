/**
 * Coordinate transformation utilities
 * Maps world coordinates (x, z) to image pixel coordinates
 *
 * CRITICAL: This is the core transformation that must be accurate.
 * Uses the LILA BLACK coordinate system: scale + origin
 *
 * Formula:
 *   u = (x - originX) / scale
 *   v = (z - originZ) / scale
 *   pixel_x = u * imageWidth
 *   pixel_y = (1 - v) * imageHeight  (Y-axis is flipped)
 */
import type { MapConfig } from '../types';

/**
 * Transform world coordinates (x, z) to image pixel coordinates
 * Note: Use x and z from telemetry (y is elevation, not used)
 */
export function worldToImage(
  worldX: number,
  worldZ: number,
  mapConfig: MapConfig
): { x: number; y: number } {
  const { scale, originX, originZ, imageWidth, imageHeight } = mapConfig;

  // Normalize world coordinates to 0-1 range
  const u = (worldX - originX) / scale;
  const v = (worldZ - originZ) / scale;

  // Convert to pixel coordinates
  // Y-axis is flipped: (1 - v) because image Y goes down
  const pixelX = u * imageWidth;
  const pixelY = (1 - v) * imageHeight;

  return { x: pixelX, y: pixelY };
}

/**
 * Transform image pixel coordinates to world coordinates
 */
export function imageToWorld(
  pixelX: number,
  pixelY: number,
  mapConfig: MapConfig
): { x: number; z: number } {
  const { scale, originX, originZ, imageWidth, imageHeight } = mapConfig;

  // Normalize pixel coordinates to 0-1 range
  const u = pixelX / imageWidth;
  const v = 1 - pixelY / imageHeight; // Invert Y

  // Convert to world coordinates
  const worldX = originX + u * scale;
  const worldZ = originZ + v * scale;

  return { x: worldX, z: worldZ };
}

/**
 * Check if world coordinates are within the valid 0-1 range
 */
export function isWorldInBounds(
  worldX: number,
  worldZ: number,
  mapConfig: MapConfig
): boolean {
  const { scale, originX, originZ } = mapConfig;

  const u = (worldX - originX) / scale;
  const v = (worldZ - originZ) / scale;

  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

/**
 * Clamp world coordinates to valid 0-1 range
 */
export function clampWorldCoordinates(
  worldX: number,
  worldZ: number,
  mapConfig: MapConfig
): { x: number; z: number } {
  const { scale, originX, originZ } = mapConfig;

  let u = (worldX - originX) / scale;
  let v = (worldZ - originZ) / scale;

  u = Math.max(0, Math.min(1, u));
  v = Math.max(0, Math.min(1, v));

  return {
    x: originX + u * scale,
    z: originZ + v * scale,
  };
}

// LILA BLACK Map Configurations
// From Level Design team - verified coordinates
export const DEFAULT_MAP_CONFIGS: MapConfig[] = [
  {
    map_id: 'AmbroseValley',
    name: 'Ambrose Valley',
    imageUrl: '/maps/AmbroseValley_Minimap.png',
    scale: 900,
    originX: -370,
    originZ: -473,
    imageWidth: 1024,
    imageHeight: 1024,
    worldBounds: {
      minX: -370,
      maxX: 530,
      minY: -473,
      maxY: 427,
    },
  },
  {
    map_id: 'GrandRift',
    name: 'Grand Rift',
    imageUrl: '/maps/GrandRift_Minimap.png',
    scale: 581,
    originX: -290,
    originZ: -290,
    imageWidth: 1024,
    imageHeight: 1024,
    worldBounds: {
      minX: -290,
      maxX: 291,
      minY: -290,
      maxY: 291,
    },
  },
  {
    map_id: 'Lockdown',
    name: 'Lockdown',
    imageUrl: '/maps/Lockdown_Minimap.jpg',
    scale: 1000,
    originX: -500,
    originZ: -500,
    imageWidth: 1024,
    imageHeight: 1024,
    worldBounds: {
      minX: -500,
      maxX: 500,
      minY: -500,
      maxY: 500,
    },
  },
];

/**
 * Get map config by ID
 */
export function getMapConfig(mapId: string): MapConfig | undefined {
  return DEFAULT_MAP_CONFIGS.find((m) => m.map_id === mapId);
}
