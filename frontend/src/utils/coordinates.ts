/**
 * Coordinate transformation utilities
 * Maps world coordinates (x, z) to image pixel coordinates
 *
 * CRITICAL: This uses the actual rendered image dimensions, not hardcoded values.
 * The map image fills the container completely (object-fit: fill behavior).
 *
 * Formula:
 *   u = (x - originX) / scale
 *   v = (z - originZ) / scale
 *   pixel_x = u * renderedWidth
 *   pixel_y = (1 - v) * renderedHeight  (Y-axis is flipped)
 */
import type { MapConfig } from '../types';

// LILA BLACK Map Configurations
export const MAP_CONFIGS: Record<string, { scale: number; originX: number; originZ: number }> = {
  AmbroseValley: { scale: 900, originX: -370, originZ: -473 },
  GrandRift: { scale: 581, originX: -290, originZ: -290 },
  Lockdown: { scale: 1000, originX: -500, originZ: -500 },
};

/**
 * Transform world coordinates (x, z) to pixel coordinates using actual rendered dimensions
 * This version uses the actual image element's rendered size
 */
export function worldToPixel(
  worldX: number,
  worldZ: number,
  mapId: string,
  renderedWidth: number,
  renderedHeight: number
): { x: number; y: number } {
  const cfg = MAP_CONFIGS[mapId];
  if (!cfg) {
    console.warn(`Unknown map: ${mapId}`);
    return { x: 0, y: 0 };
  }

  const u = (worldX - cfg.originX) / cfg.scale;
  const v = (worldZ - cfg.originZ) / cfg.scale;

  return {
    x: u * renderedWidth,
    y: (1 - v) * renderedHeight, // Y is flipped
  };
}

/**
 * Transform pixel coordinates to world coordinates
 */
export function pixelToWorld(
  pixelX: number,
  pixelY: number,
  mapId: string,
  renderedWidth: number,
  renderedHeight: number
): { x: number; z: number } {
  const cfg = MAP_CONFIGS[mapId];
  if (!cfg || renderedWidth === 0 || renderedHeight === 0) {
    return { x: 0, z: 0 };
  }

  const u = pixelX / renderedWidth;
  const v = 1 - pixelY / renderedHeight; // Invert Y

  return {
    x: cfg.originX + u * cfg.scale,
    z: cfg.originZ + v * cfg.scale,
  };
}

/**
 * Legacy function - kept for compatibility
 * Use worldToPixel with actual rendered dimensions for precise alignment
 */
export function worldToImage(
  worldX: number,
  worldZ: number,
  mapConfig: MapConfig
): { x: number; y: number } {
  const u = (worldX - mapConfig.originX) / mapConfig.scale;
  const v = (worldZ - mapConfig.originZ) / mapConfig.scale;

  return {
    x: u * mapConfig.imageWidth,
    y: (1 - v) * mapConfig.imageHeight,
  };
}

/**
 * Check if world coordinates are within the valid 0-1 range
 */
export function isWorldInBounds(
  worldX: number,
  worldZ: number,
  mapConfig: MapConfig
): boolean {
  const u = (worldX - mapConfig.originX) / mapConfig.scale;
  const v = (worldZ - mapConfig.originZ) / mapConfig.scale;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

// Legacy Map Configurations (kept for compatibility)
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
    worldBounds: { minX: -370, maxX: 530, minY: -473, maxY: 427 },
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
    worldBounds: { minX: -290, maxX: 291, minY: -290, maxY: 291 },
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
    worldBounds: { minX: -500, maxX: 500, minY: -500, maxY: 500 },
  },
];

export function getMapConfig(mapId: string): MapConfig | undefined {
  return DEFAULT_MAP_CONFIGS.find((m) => m.map_id === mapId);
}

/**
 * Get world bounds for a map
 */
export function getMapBounds(mapId: string): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  const config = MAP_CONFIGS[mapId];
  if (!config) return null;

  return {
    minX: config.originX,
    maxX: config.originX + config.scale,
    minZ: config.originZ,
    maxZ: config.originZ + config.scale,
  };
}
