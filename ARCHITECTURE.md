# Architecture - Player Journey Visualization Tool

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   React UI   │  │  Konva.js    │  │ Apache Arrow │     │
│  │  Components  │  │   Canvas     │  │ Parquet WASM │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│  ┌──────┴─────────────────┴─────────────────┴──────┐        │
│  │              State Management                   │        │
│  │            (React Hooks)                        │        │
│  └──────────────────┬────────────────────────────┘        │
│                     │                                       │
│              ┌──────┴──────┐                                │
│              │  Data Store │                                │
│              │  (In-Memory)│                                │
│              └─────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Layers

1. **Presentation Layer** (`App.tsx`)
   - Main application shell
   - State coordination
   - Sidebar + Timeline controls

2. **Visualization Layer** (`MapCanvas.tsx`)
   - Konva Stage/Layer components
   - Player path rendering
   - Event marker rendering
   - Click/interaction handling

3. **Data Layer** (`dataLoader.ts`)
   - Parquet file parsing
   - Mock data generation
   - Match data processing

4. **Utility Layer** (`coordinates.ts`)
   - World ↔ Image coordinate transforms
   - Map configuration

## Data Flow

```
Parquet File → Apache Arrow → PlayerEvent[] → Process → MatchData[]
                                                     ↓
Mock Data    → Generator  → PlayerEvent[] → Process → MatchData[]
                                                     ↓
                                          MapCanvas ← App State
```

## State Management

### Application State (App.tsx)
```typescript
{
  matches: MatchData[]
  selectedMatchId: string | null
  selectedPlayerId: string | null
  filters: FilterState
  timeline: TimelineState
}
```

### Timeline State
```typescript
{
  currentTime: number      // Current playback position
  isPlaying: boolean        // Playback state
  playbackSpeed: number    // 0.5x - 10x
  startTime: number        // Match start
  endTime: number          // Match end
}
```

## Rendering Pipeline

1. **Frame Update** (requestAnimationFrame)
   - Timeline updates currentTime
   - Filter state determines visible players/events

2. **MapCanvas Render**
   - Draw minimap image
   - For each visible player:
     - Calculate image coordinates for events ≤ currentTime
     - Draw path line
     - Draw event markers
     - Draw current position indicator

3. **Event Filtering**
   - Only render events with timestamp ≤ currentTime
   - Only render event types selected in filters

## Coordinate Transformation

```
World Coordinates → Normalized (0-1) → Image Coordinates

World X: [-5000, 5000] → [0, 1] → [0, 1024]
World Y: [-5000, 5000] → [0, 1] → [1024, 0] (inverted)
```

See `utils/coordinates.ts` for implementation.

## Performance Considerations

1. **Canvas Rendering**
   - Use Konva for efficient canvas operations
   - Only render visible events
   - Batch path drawing operations

2. **Data Processing**
   - Process parquet files once on load
   - Store in memory (MatchData[])
   - Filter at render time

3. **Mock Data Limits**
   - 48 players (12 human, 36 bot)
   - 50 events per player
   - ~2400 events per match

## Security

- Browser-side processing (no data sent to server)
- File upload limited to parquet/arrow files
- No user authentication needed

## Extension Points

1. **New Event Types**
   - Add to `EventType` union type
   - Add color to `EVENT_COLORS`
   - Update filter UI

2. **New Maps**
   - Add to `DEFAULT_MAP_CONFIGS`
   - Verify world bounds with Level Design

3. **Heatmap Layer** (Phase 2)
   - Add heatmap.js overlay
   - Process events into density grid
   - Render as transparent overlay on Konva
