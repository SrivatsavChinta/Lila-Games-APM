/**
 * Core types for the Player Journey Visualization Tool
 * Lila Games - LILA BLACK Telemetry
 */

export interface PlayerEvent {
  id: string;
  player_id: string;
  match_id: string;
  map_id: string;
  timestamp: number; // Unix timestamp in milliseconds
  x: number; // World coordinate X
  y: number; // World coordinate Z (for 2D minimap plotting)
  z: number; // World coordinate Y (elevation - not used for minimap)
  event_type: EventType;
  is_bot: boolean;
  metadata?: Record<string, unknown>; // Additional event-specific data
}

export type EventType =
  | 'position' // Regular position update
  | 'kill' // Player killed someone
  | 'death' // Player died
  | 'loot' // Picked up loot
  | 'storm_death' // Died to storm/zone
  | 'extract'; // Successfully extracted

export interface PlayerJourney {
  player_id: string;
  match_id: string;
  map_id: string;
  is_bot: boolean;
  events: PlayerEvent[];
  startTime: number;
  endTime: number;
}

export interface MatchData {
  match_id: string;
  map_id: string;
  startTime: number;
  endTime: number;
  players: PlayerJourney[];
  allEvents: PlayerEvent[];
}

export interface MapConfig {
  map_id: string;
  name: string;
  imageUrl: string;
  // Coordinate system: scale + origin (LILA BLACK specific)
  scale: number;
  originX: number;
  originZ: number;
  imageWidth: number;
  imageHeight: number;
  // World bounds for coordinate transformation
  worldBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface FilterState {
  mapId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  matchId: string | null;
  showBots: boolean;
  showHumans: boolean;
  eventTypes: EventType[];
}

export interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  startTime: number;
  endTime: number;
}

export interface HeatmapConfig {
  enabled: boolean;
  type: 'kills' | 'deaths' | 'traffic' | 'loot';
  radius: number;
  blur: number;
  maxOpacity: number;
}
