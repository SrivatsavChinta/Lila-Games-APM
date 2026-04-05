/**
 * Data loading utilities for parquet and mock data
 */
import type { PlayerEvent, MatchData, PlayerJourney } from '../types';
import { tableFromIPC } from 'apache-arrow';

// Mock data generator for testing without parquet files
export function generateMockData(mapId: string = 'map_01'): MatchData {
  const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const startTime = Date.now() - 1000 * 60 * 15; // 15 minutes ago
  const endTime = Date.now();

  const numHumans = 12;
  const numBots = 36;
  const eventsPerPlayer = 50;

  const players: PlayerJourney[] = [];
  const allEvents: PlayerEvent[] = [];

  // Generate players
  for (let i = 0; i < numHumans + numBots; i++) {
    const isBot = i >= numHumans;
    const playerId = isBot ? `bot_${i - numHumans + 1}` : `player_${i + 1}`;

    // Random starting position (world coords: -5000 to 5000)
    let x = (Math.random() - 0.5) * 10000;
    let y = (Math.random() - 0.5) * 10000;

    const events: PlayerEvent[] = [];
    let currentTime = startTime;

    for (let j = 0; j < eventsPerPlayer; j++) {
      // Random movement
      x += (Math.random() - 0.5) * 500;
      y += (Math.random() - 0.5) * 500;

      // Clamp to world bounds
      x = Math.max(-5000, Math.min(5000, x));
      y = Math.max(-5000, Math.min(5000, y));

      currentTime += Math.random() * 1000 * 10; // 0-10 seconds between events

      // Determine event type
      let eventType: PlayerEvent['event_type'] = 'position';
      const rand = Math.random();
      if (rand < 0.02) eventType = 'kill';
      else if (rand < 0.04) eventType = 'death';
      else if (rand < 0.08) eventType = 'loot';
      else if (rand < 0.09) eventType = 'storm_death';

      // Stop generating if past end time
      if (currentTime > endTime) break;

      const event: PlayerEvent = {
        id: `${matchId}_${playerId}_${j}`,
        player_id: playerId,
        match_id: matchId,
        map_id: mapId,
        timestamp: currentTime,
        x,
        y,
        event_type: eventType,
        is_bot: isBot,
      };

      events.push(event);
      allEvents.push(event);
    }

    if (events.length > 0) {
      players.push({
        player_id: playerId,
        match_id: matchId,
        map_id: mapId,
        is_bot: isBot,
        events,
        startTime: events[0].timestamp,
        endTime: events[events.length - 1].timestamp,
      });
    }
  }

  return {
    match_id: matchId,
    map_id: mapId,
    startTime,
    endTime,
    players,
    allEvents,
  };
}

// Load parquet file from URL or File
export async function loadParquetFile(
  source: string | File
): Promise<PlayerEvent[]> {
  try {
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

    // For now, we'll use Arrow IPC format
    // Parquet support requires additional WASM setup
    const table = tableFromIPC(new Uint8Array(buffer));

    // Convert Arrow table to PlayerEvent array
    const events: PlayerEvent[] = [];
    const numRows = table.numRows;

    const playerIdCol = table.getChild('player_id');
    const matchIdCol = table.getChild('match_id');
    const mapIdCol = table.getChild('map_id');
    const timestampCol = table.getChild('timestamp');
    const xCol = table.getChild('x');
    const yCol = table.getChild('y');
    const eventTypeCol = table.getChild('event_type');
    const isBotCol = table.getChild('is_bot');

    for (let i = 0; i < numRows; i++) {
      events.push({
        id: `${matchIdCol?.get(i)}_${playerIdCol?.get(i)}_${i}`,
        player_id: String(playerIdCol?.get(i) ?? ''), // Added nullish coalescing
        match_id: String(matchIdCol?.get(i) ?? ''),
        map_id: String(mapIdCol?.get(i) ?? ''),
        timestamp: Number(timestampCol?.get(i) ?? 0),
        x: Number(xCol?.get(i) ?? 0),
        y: Number(yCol?.get(i) ?? 0),
        event_type: String(eventTypeCol?.get(i) ?? 'position') as PlayerEvent['event_type'],
        is_bot: Boolean(isBotCol?.get(i) ?? false),
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
