/**
 * Data loading utilities for parquet and mock data
 *
 * REAL Parquet Schema (confirmed from sample_player_data.parquet):
 *   - match_id: string
 *   - map_name: string — 'Outpost' | 'Citadel' | 'Wasteland'
 *   - event_date: string
 *   - timestamp: ISO datetime string e.g. '2026-04-01T18:00:15'
 *   - player_id: string
 *   - is_bot: boolean
 *   - x_coord: float 0-1000
 *   - y_coord: float 0-979
 *   - event_type: 'kill' | 'move' | 'storm_death' | 'death' | 'loot'
 *
 * INTERNAL STORAGE:
 *   event.x = x_coord (0-1000)
 *   event.y = y_coord (0-979)  ← 2D horizontal position
 *   event.z = 0                ← unused
 */
import type { PlayerEvent, MatchData, PlayerJourney } from '../types';
import { tableFromIPC } from 'apache-arrow';
import * as parquetWasm from 'parquet-wasm';

let wasmInitialized: Promise<void> | null = null;

async function initParquetWasm(): Promise<void> {
  if (!wasmInitialized) {
    wasmInitialized = parquetWasm.default().then(() => {
      console.log('Parquet WASM initialized');
    });
  }
  return wasmInitialized;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapEventType(rawEvent: string): PlayerEvent['event_type'] {
  const mapping: Record<string, PlayerEvent['event_type']> = {
    // Real parquet schema
    move:        'position',
    kill:        'kill',
    death:       'death',
    storm_death: 'storm_death',
    loot:        'loot',
    // Legacy README schema fallback
    Position:       'position',
    BotPosition:    'position',
    Kill:           'kill',
    Killed:         'death',
    BotKill:        'kill',
    BotKilled:      'death',
    KilledByStorm:  'storm_death',
    Loot:           'loot',
  };
  return mapping[rawEvent] ?? 'position';
}

function parseTimestamp(ts: string | number): number {
  if (typeof ts === 'number') return ts;
  return Date.parse(ts);
}

// Generate one player's events with proper 2D movement
function generatePlayerEvents(
  playerId: string,
  matchId: string,
  mapName: string,
  isBot: boolean,
  baseTime: number,
  numEvents: number
): PlayerEvent[] {
  const events: PlayerEvent[] = [];

  // Random start position within 0-1000 / 0-979
  let x = 100 + Math.random() * 800;  // avoid edges
  let y = 100 + Math.random() * 779;  // avoid edges

  let currentMs = 0;

  for (let j = 0; j < numEvents; j++) {
    currentMs += 8000 + Math.random() * 7000; // 8-15s between events

    // Random walk — move in BOTH x AND y
    x += (Math.random() - 0.5) * 150;
    y += (Math.random() - 0.5) * 150;

    // Clamp to valid range
    x = Math.max(0, Math.min(1000, x));
    y = Math.max(0, Math.min(979, y));

    // Weighted event distribution matching real data
    const rand = Math.random();
    let rawEvent: string;
    if      (rand < 0.50) rawEvent = 'move';
    else if (rand < 0.65) rawEvent = 'kill';
    else if (rand < 0.80) rawEvent = 'death';
    else if (rand < 0.92) rawEvent = 'storm_death';
    else                  rawEvent = 'loot';

    events.push({
      id:         `${matchId}_${playerId}_${j}`,
      player_id:  playerId,
      match_id:   matchId,
      map_id:     mapName,
      timestamp:  baseTime + currentMs,
      x:          x,   // x_coord 0-1000
      y:          y,   // y_coord 0-979 (2D position, NOT elevation)
      z:          0,   // unused
      event_type: mapEventType(rawEvent),
      is_bot:     isBot,
    });
  }

  return events;
}

function generateSingleMatch(mapName: string, matchIndex: number): MatchData {
  const matchId   = `match_${String(matchIndex + 1).padStart(3, '0')}`;
  const baseTime  = new Date('2026-04-01T18:00:00').getTime() + matchIndex * 3600000;

  const numHumans = 5;
  const numBots   = 3;

  const players:   PlayerJourney[] = [];
  const allEvents: PlayerEvent[]   = [];

  // Generate humans
  for (let i = 0; i < numHumans; i++) {
    const playerId = `player_${i}`;
    const numEvents = 60 + Math.floor(Math.random() * 40);
    const events = generatePlayerEvents(playerId, matchId, mapName, false, baseTime, numEvents);

    allEvents.push(...events);

    if (events.length > 0) {
      players.push({
        player_id:  playerId,
        match_id:   matchId,
        map_id:     mapName,
        is_bot:     false,
        events,
        startTime:  events[0].timestamp,
        endTime:    events[events.length - 1].timestamp,
      });
    }
  }

  // Generate bots
  for (let i = 0; i < numBots; i++) {
    const playerId  = `bot_${i}`;
    const numEvents = 60 + Math.floor(Math.random() * 40);
    const events    = generatePlayerEvents(playerId, matchId, mapName, true, baseTime, numEvents);

    allEvents.push(...events);

    if (events.length > 0) {
      players.push({
        player_id:  playerId,
        match_id:   matchId,
        map_id:     mapName,
        is_bot:     true,
        events,
        startTime:  events[0].timestamp,
        endTime:    events[events.length - 1].timestamp,
      });
    }
  }

  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  return {
    match_id:   matchId,
    map_id:     mapName,
    startTime:  allEvents[0]?.timestamp  ?? baseTime,
    endTime:    allEvents[allEvents.length - 1]?.timestamp ?? baseTime + 900000,
    players,
    allEvents,
  };
}

export function generateMockData(mapName: string = 'Outpost'): MatchData {
  return generateSingleMatch(mapName, 0);
}

export function generateMultipleMatches(mapName: string = 'Outpost', count: number = 3): MatchData[] {
  const maps = ['Outpost', 'Citadel', 'Wasteland'];
  return Array.from({ length: count }, (_, i) =>
    generateSingleMatch(maps[i % maps.length], i)
  );
}

export async function loadParquetFile(source: string | File): Promise<PlayerEvent[]> {
  try {
    await initParquetWasm();

    let buffer: ArrayBuffer;
    if (typeof source === 'string') {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
      buffer = await response.arrayBuffer();
    } else {
      buffer = await source.arrayBuffer();
    }

    const arrowWasmTable = parquetWasm.readParquet(new Uint8Array(buffer));
    const ipcBytes       = arrowWasmTable.intoIPCStream();
    const table          = tableFromIPC(ipcBytes);
    const numRows        = table.numRows;

    // Real schema columns
    const playerIdCol  = table.getChild('player_id');
    const matchIdCol   = table.getChild('match_id');
    const mapNameCol   = table.getChild('map_name');
    const xCoordCol    = table.getChild('x_coord');
    const yCoordCol    = table.getChild('y_coord');
    const tsCol        = table.getChild('timestamp');
    const eventTypeCol = table.getChild('event_type');
    const isBotCol     = table.getChild('is_bot');

    // Fallback old README schema columns
    const userIdFallback  = table.getChild('user_id');
    const mapIdFallback   = table.getChild('map_id');
    const xFallback       = table.getChild('x');
    const zFallback       = table.getChild('z');
    const eventFallback   = table.getChild('event');
    const tsFallback      = table.getChild('ts');

    const isRealSchema = !!playerIdCol && !!xCoordCol;

    // Find min timestamp to normalize to elapsed ms
    let minTs = Infinity;
    for (let i = 0; i < numRows; i++) {
      const rawTs = isRealSchema
        ? parseTimestamp(String(tsCol?.get(i) ?? ''))
        : Number(tsFallback?.get(i) ?? 0);
      if (rawTs < minTs) minTs = rawTs;
    }

    const events: PlayerEvent[] = [];

    for (let i = 0; i < numRows; i++) {
      let playerId:  string;
      let matchId:   string;
      let mapId:     string;
      let x:         number;
      let y:         number;
      let rawEvent:  string;
      let timestamp: number;
      let isBot:     boolean;

      if (isRealSchema) {
        playerId  = String(playerIdCol?.get(i)  ?? '');
        matchId   = String(matchIdCol?.get(i)   ?? '');
        mapId     = String(mapNameCol?.get(i)   ?? 'Outpost');
        x         = Number(xCoordCol?.get(i)    ?? 0);  // 0-1000
        y         = Number(yCoordCol?.get(i)    ?? 0);  // 0-979
        rawEvent  = String(eventTypeCol?.get(i) ?? 'move');
        timestamp = parseTimestamp(String(tsCol?.get(i) ?? '')) - minTs;
        isBot     = Boolean(isBotCol?.get(i)    ?? false);
      } else {
        // Old README schema — world coords, need to normalize
        playerId  = String(userIdFallback?.get(i)  ?? '');
        matchId   = String(matchIdCol?.get(i)      ?? '');
        mapId     = String(mapIdFallback?.get(i)   ?? '');
        // Store world x/z directly — worldToPixel handles conversion
        x         = Number(xFallback?.get(i)       ?? 0);
        y         = Number(zFallback?.get(i)        ?? 0);
        rawEvent  = String(eventFallback?.get(i)   ?? 'Position');
        timestamp = Number(tsFallback?.get(i)      ?? 0) - minTs;
        isBot     = /^\d+$/.test(playerId);
      }

      events.push({
        id:         `${matchId}_${playerId}_${i}`,
        player_id:  playerId,
        match_id:   matchId,
        map_id:     mapId,
        timestamp,
        x,
        y,
        z:          0,
        event_type: mapEventType(rawEvent),
        is_bot:     isBot,
      });
    }

    return events;
  } catch (error) {
    console.error('Error loading parquet:', error);
    throw error;
  }
}

export function processEventsIntoMatches(events: PlayerEvent[]): MatchData[] {
  const matchesById = new Map<string, MatchData>();

  for (const event of events) {
    if (!matchesById.has(event.match_id)) {
      matchesById.set(event.match_id, {
        match_id:  event.match_id,
        map_id:    event.map_id,
        startTime: event.timestamp,
        endTime:   event.timestamp,
        players:   [],
        allEvents: [],
      });
    }
    const match = matchesById.get(event.match_id)!;
    match.allEvents.push(event);
    match.startTime = Math.min(match.startTime, event.timestamp);
    match.endTime   = Math.max(match.endTime,   event.timestamp);
  }

  for (const match of matchesById.values()) {
    const playerEvents = new Map<string, PlayerEvent[]>();

    for (const event of match.allEvents) {
      if (!playerEvents.has(event.player_id)) {
        playerEvents.set(event.player_id, []);
      }
      playerEvents.get(event.player_id)!.push(event);
    }

    for (const [playerId, pevents] of playerEvents) {
      pevents.sort((a, b) => a.timestamp - b.timestamp);
      match.players.push({
        player_id:  playerId,
        match_id:   match.match_id,
        map_id:     match.map_id,
        is_bot:     pevents[0].is_bot,
        events:     pevents,
        startTime:  pevents[0].timestamp,
        endTime:    pevents[pevents.length - 1].timestamp,
      });
    }

    match.players.sort((a, b) => {
      if (a.is_bot !== b.is_bot) return a.is_bot ? 1 : -1;
      return a.player_id.localeCompare(b.player_id);
    });
  }

  return Array.from(matchesById.values());
}