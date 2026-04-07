/**
 * Data loading utilities for parquet and mock data
 *
 * Parquet Schema (from README):
 *   - user_id: UUID string = human, numeric string (e.g., "1440") = bot
 *   - match_id: string
 *   - map_id: one of "AmbroseValley", "GrandRift", "Lockdown"
 *   - x, y, z: world position floats (x, z used for 2D plotting)
 *   - ts: timestamp in milliseconds (time elapsed within match)
 *   - event: "Position", "BotPosition", "Kill", "Killed", "BotKill", "BotKilled", "KilledByStorm", "Loot"
 */
import type {
  PlayerEvent,
  MatchData,
  PlayerJourney,
} from '../types';
import { tableFromIPC } from 'apache-arrow';
import * as parquetWasm from 'parquet-wasm';

// Initialize parquet-wasm WASM module
let wasmInitialized: Promise<void> | null = null;

async function initParquetWasm(): Promise<void> {
  if (!wasmInitialized) {
    wasmInitialized = parquetWasm.default().then(() => {
      console.log('Parquet WASM initialized');
    });
  }
  return wasmInitialized;
}

// Map world bounds from the map configs
const MAP_BOUNDS: Record<
  string,
  { minX: number; maxX: number; minZ: number; maxZ: number }
> = {
  AmbroseValley: { minX: -370, maxX: 530, minZ: -473, maxZ: 427 },
  GrandRift: { minX: -290, maxX: 291, minZ: -290, maxZ: 291 },
  Lockdown: { minX: -500, maxX: 500, minZ: -500, maxZ: 500 },
};

// Event type probabilities for realistic distribution
const EVENT_DISTRIBUTION = [
  { type: 'Position', prob: 0.6, isBot: false },
  { type: 'BotPosition', prob: 0.25, isBot: true },
  { type: 'Kill', prob: 0.015, isBot: false },
  { type: 'Killed', prob: 0.015, isBot: false },
  { type: 'BotKill', prob: 0.02, isBot: true },
  { type: 'BotKilled', prob: 0.02, isBot: true },
  { type: 'KilledByStorm', prob: 0.01, isBot: false },
  { type: 'Loot', prob: 0.07, isBot: false },
];

// Generate a UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generate a random position within map bounds
function generateRandomPosition(
  mapBounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  previousX?: number,
  previousZ?: number
): { x: number; y: number; z: number } {
  let x: number;
  let z: number;

  if (previousX !== undefined && previousZ !== undefined) {
    // Continue from previous position with small random movement
    const moveRange = 30; // Max movement per tick
    x = previousX + (Math.random() - 0.5) * moveRange * 2;
    z = previousZ + (Math.random() - 0.5) * moveRange * 2;

    // Clamp to map bounds
    x = Math.max(mapBounds.minX, Math.min(mapBounds.maxX, x));
    z = Math.max(mapBounds.minZ, Math.min(mapBounds.maxZ, z));
  } else {
    // Random position within bounds
    x = mapBounds.minX + Math.random() * (mapBounds.maxX - mapBounds.minX);
    z = mapBounds.minZ + Math.random() * (mapBounds.maxZ - mapBounds.minZ);
  }

  // y is elevation/height - generate realistic values (0-500 units)
  const y = Math.random() * 500;

  return { x, y, z };
}

// Map event types from parquet schema to internal types
function mapEventType(parquetEvent: string): PlayerEvent['event_type'] {
  const mapping: Record<string, PlayerEvent['event_type']> = {
    Position: 'position',
    BotPosition: 'position',
    Kill: 'kill',
    Killed: 'death',
    BotKill: 'kill',
    BotKilled: 'death',
    KilledByStorm: 'storm_death',
    Loot: 'loot',
  };
  return mapping[parquetEvent] || 'position';
}

/**
 * Mock data generator for testing without parquet files
 * Follows the LILA BLACK parquet schema:
 *   - user_id: UUID for humans, numeric for bots
 *   - x, z: world coordinates for 2D plotting
 *   - y: elevation (not used for minimap)
 *   - ts: timestamp in milliseconds within match
 *   - event: Position, BotPosition, Kill, Killed, etc.
 */
export function generateMockData(mapId: string = 'AmbroseValley'): MatchData {
  const matchId = generateUUID();
  const mapBounds = MAP_BOUNDS[mapId] || MAP_BOUNDS['AmbroseValley'];

  // Match duration: 10-20 minutes in milliseconds
  const matchDuration = (10 + Math.random() * 10) * 60 * 1000;
  const matchStartTime = Date.now();

  const numHumans = 12;
  const numBots = 36;
  const eventsPerSecond = 2; // Events per player per second
  const totalEvents = Math.floor(matchDuration / 1000) * eventsPerSecond;

  const players: PlayerJourney[] = [];
  const allEvents: PlayerEvent[] = [];

  // Generate human players (UUID user_ids)
  for (let i = 0; i < numHumans; i++) {
    const userId = generateUUID();
    const isBot = false;

    // Random starting position
    let pos = generateRandomPosition(mapBounds);
    let currentTime = 0;

    const events: PlayerEvent[] = [];
    const eventsForPlayer = Math.floor(
      totalEvents / (numHumans + numBots) + Math.random() * 50
    );

    for (let j = 0; j < eventsForPlayer; j++) {
      // Time between events: 200-800ms (2-5 events per second)
      currentTime += 200 + Math.random() * 600;

      if (currentTime > matchDuration) break;

      // Determine event type based on distribution
      const rand = Math.random();
      let eventType = 'Position';
      let cumulativeProb = 0;

      for (const evt of EVENT_DISTRIBUTION) {
        cumulativeProb += evt.prob;
        if (rand < cumulativeProb) {
          if (evt.isBot === isBot || (evt.isBot && isBot) || (!evt.isBot && !isBot)) {
            eventType = evt.type;
            break;
          }
        }
      }

      // Only movement events change position
      if (
        eventType === 'Position' ||
        eventType === 'BotPosition' ||
        eventType === 'Loot'
      ) {
        pos = generateRandomPosition(mapBounds, pos.x, pos.z);
      }

      const event: PlayerEvent = {
        id: `${matchId}_${userId}_${j}`,
        player_id: userId,
        match_id: matchId,
        map_id: mapId,
        timestamp: matchStartTime + currentTime,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        event_type: mapEventType(eventType),
        is_bot: isBot,
      };

      events.push(event);
      allEvents.push(event);
    }

    if (events.length > 0) {
      players.push({
        player_id: userId,
        match_id: matchId,
        map_id: mapId,
        is_bot: isBot,
        events,
        startTime: events[0].timestamp,
        endTime: events[events.length - 1].timestamp,
      });
    }
  }

  // Generate bots (numeric user_ids like "1440", "1441", etc.)
  const botStartId = 1401;
  for (let i = 0; i < numBots; i++) {
    const userId = String(botStartId + i);
    const isBot = true;

    // Random starting position
    let pos = generateRandomPosition(mapBounds);
    let currentTime = 0;

    const events: PlayerEvent[] = [];
    const eventsForPlayer = Math.floor(
      totalEvents / (numHumans + numBots) + Math.random() * 30
    );

    for (let j = 0; j < eventsForPlayer; j++) {
      // Time between events: 300-1000ms
      currentTime += 300 + Math.random() * 700;

      if (currentTime > matchDuration) break;

      // Determine event type - bots mostly have BotPosition
      const rand = Math.random();
      let eventType = 'BotPosition';

      if (rand < 0.85) {
        eventType = 'BotPosition';
      } else if (rand < 0.90) {
        eventType = 'BotKill';
      } else if (rand < 0.95) {
        eventType = 'BotKilled';
      } else if (rand < 0.98) {
        eventType = 'Loot';
      } else {
        eventType = 'KilledByStorm';
      }

      // Only movement events change position
      if (eventType === 'BotPosition' || eventType === 'Loot') {
        pos = generateRandomPosition(mapBounds, pos.x, pos.z);
      }

      const event: PlayerEvent = {
        id: `${matchId}_${userId}_${j}`,
        player_id: userId,
        match_id: matchId,
        map_id: mapId,
        timestamp: matchStartTime + currentTime,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        event_type: mapEventType(eventType),
        is_bot: isBot,
      };

      events.push(event);
      allEvents.push(event);
    }

    if (events.length > 0) {
      players.push({
        player_id: userId,
        match_id: matchId,
        map_id: mapId,
        is_bot: isBot,
        events,
        startTime: events[0].timestamp,
        endTime: events[events.length - 1].timestamp,
      });
    }
  }

  // Sort all events by timestamp
  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  return {
    match_id: matchId,
    map_id: mapId,
    startTime: matchStartTime,
    endTime: matchStartTime + matchDuration,
    players,
    allEvents,
  };
}

/**
 * Generate mock data for a specific map
 * This is a convenience wrapper around generateMockData
 */
export function generateMockDataForMap(mapId: string): MatchData {
  return generateMockData(mapId);
}

// Load parquet file from URL or File
export async function loadParquetFile(
  source: string | File
): Promise<PlayerEvent[]> {
  try {
    // Ensure WASM is initialized
    await initParquetWasm();

    let buffer: ArrayBuffer;

    if (typeof source === 'string') {
      // Load from URL
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch parquet: ${response.statusText}`);
      }
      buffer = await response.arrayBuffer();
    } else {
      // Load from File
      buffer = await source.arrayBuffer();
    }

    // Use parquet-wasm to read the parquet file
    const arrowWasmTable = parquetWasm.readParquet(new Uint8Array(buffer));

    // Convert WASM table to Arrow JS table using IPC format
    const ipcBytes = arrowWasmTable.intoIPCStream();
    const table = tableFromIPC(ipcBytes);

    // Convert Arrow table to PlayerEvent array
    // Schema: user_id, match_id, map_id, x, y, z, ts, event
    const events: PlayerEvent[] = [];
    const numRows = table.numRows;

    const userIdCol = table.getChild('user_id');
    const matchIdCol = table.getChild('match_id');
    const mapIdCol = table.getChild('map_id');
    const xCol = table.getChild('x');
    const yCol = table.getChild('y');
    const zCol = table.getChild('z');
    const tsCol = table.getChild('ts');
    const eventCol = table.getChild('event');

    for (let i = 0; i < numRows; i++) {
      const userId = String(userIdCol?.get(i) ?? '');
      const eventType = String(eventCol?.get(i) ?? 'Position');
      const isBot = /^\d+$/.test(userId); // Numeric user_id = bot

      // Note: x is x, z is z (y in parquet is elevation, not used for minimap)
      const worldX = Number(xCol?.get(i) ?? 0);
      const worldY = Number(zCol?.get(i) ?? 0); // z from parquet is y in our system
      const elevation = Number(yCol?.get(i) ?? 0); // y from parquet is elevation

      events.push({
        id: `${matchIdCol?.get(i)}_${userId}_${i}`,
        player_id: userId,
        match_id: String(matchIdCol?.get(i) ?? ''),
        map_id: String(mapIdCol?.get(i) ?? ''),
        timestamp: Number(tsCol?.get(i) ?? 0),
        x: worldX,
        y: worldY, // This is the z coordinate from parquet (for 2D plotting)
        z: elevation, // This is elevation (not used for minimap)
        event_type: mapEventType(eventType),
        is_bot: isBot,
      });
    }

    return events;
  } catch (error) {
    console.error('Error loading parquet:', error);
    throw error;
  }
}

// Process events into match data structure
export function processEventsIntoMatches(events: PlayerEvent[]): MatchData[] {
  const matchesById = new Map<string, MatchData>();

  for (const event of events) {
    if (!matchesById.has(event.match_id)) {
      matchesById.set(event.match_id, {
        match_id: event.match_id,
        map_id: event.map_id,
        startTime: event.timestamp,
        endTime: event.timestamp,
        players: [],
        allEvents: [],
      });
    }

    const match = matchesById.get(event.match_id)!;
    match.allEvents.push(event);
    match.startTime = Math.min(match.startTime, event.timestamp);
    match.endTime = Math.max(match.endTime, event.timestamp);
  }

  // Group events by player within each match
  for (const match of matchesById.values()) {
    const playerEvents = new Map<string, PlayerEvent[]>();

    for (const event of match.allEvents) {
      if (!playerEvents.has(event.player_id)) {
        playerEvents.set(event.player_id, []);
      }
      playerEvents.get(event.player_id)!.push(event);
    }

    // Create player journeys
    for (const [playerId, events] of playerEvents) {
      events.sort((a, b) => a.timestamp - b.timestamp);

      match.players.push({
        player_id: playerId,
        match_id: match.match_id,
        map_id: match.map_id,
        is_bot: events[0].is_bot,
        events,
        startTime: events[0].timestamp,
        endTime: events[events.length - 1].timestamp,
      });
    }

    // Sort players by bot status then by ID
    match.players.sort((a, b) => {
      if (a.is_bot !== b.is_bot) return a.is_bot ? 1 : -1;
      return a.player_id.localeCompare(b.player_id);
    });
  }

  return Array.from(matchesById.values());
}

// Export mock data as JSON (for debugging/inspection)
export function exportMockDataToJSON(matchData: MatchData): string {
  return JSON.stringify(matchData, null, 2);
}

// Export mock data as parquet-compatible format
export function exportMockDataToParquetFormat(
  matchData: MatchData
): Record<string, unknown>[] {
  return matchData.allEvents.map((event) => ({
    user_id: event.player_id,
    match_id: event.match_id,
    map_id: event.map_id,
    x: event.x,
    y: event.z, // z is elevation in parquet
    z: event.y, // y is the z coordinate in parquet (for 2D plotting)
    ts: event.timestamp,
    event: event.event_type,
  }));
}
