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
 *
 * For runtime alignment:
 *   - NEVER use hardcoded 1024 values
 *   - ALWAYS use the actual rendered dimensions from getBoundingClientRect()
 *   - The heatmap canvas MUST match the map container exactly
 */
import type { MapConfig } from '../types';

/**
 * Transform world coordinates (x, z) to image pixel coordinates
 * Note: Use x and z from telemetry (y is elevation, not used)
 *
 * This returns coordinates in the ORIGINAL image coordinate space (e.g., 0-1024).
 * To get screen coordinates, you must scale these based on the actual rendered size.
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

/**
 * Calculate the actual rendered dimensions of a map within a container
 * This maintains aspect ratio and centers the map (letterboxing if needed)
 *
 * CRITICAL: Use this to sync heatmap dimensions with the actual visible map
 *
 * @param containerWidth - The actual container width in pixels (from getBoundingClientRect)
 * @param containerHeight - The actual container height in pixels (from getBoundingClientRect)
 * @param mapImageWidth - The original map image width (e.g., 1024)
 * @param mapImageHeight - The original map image height (e.g., 1024)
 * @returns Object with render dimensions and offsets for centering
 */
export function getMapRenderDimensions(
  containerWidth: number,
  containerHeight: number,
  mapImageWidth: number,
  mapImageHeight: number
): {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
} {
  if (containerWidth === 0 || containerHeight === 0) {
    return { width: 0, height: 0, scale: 1, offsetX: 0, offsetY: 0 };
  }

  // Calculate scale to fit within container while preserving aspect ratio
  const scaleX = containerWidth / mapImageWidth;
  const scaleY = containerHeight / mapImageHeight;
  const scale = Math.min(scaleX, scaleY);

  // Calculate rendered dimensions
  const width = mapImageWidth * scale;
  const height = mapImageHeight * scale;

  // Calculate centering offsets (for letterboxing)
  const offsetX = (containerWidth - width) / 2;
  const offsetY = (containerHeight - height) / 2;

  return { width, height, scale, offsetX, offsetY };
}

// LILA BLACK Map Configurations
// From Level Design team - verified coordinates
//
// Coordinate system:
//   - scale: The size of the map in world units
//   - originX, originZ: The world coordinates of the bottom-left (0,0) of the minimap
//
// World bounds for each map:
//   AmbroseValley: x in [-370, 530], z in [-473, 427]  (scale=900)
//   GrandRift:     x in [-290, 291], z in [-290, 291]  (scale=581)
//   Lockdown:      x in [-500, 500],  z in [-500, 500]  (scale=1000)
//
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
