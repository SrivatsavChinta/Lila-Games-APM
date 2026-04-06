# Development Insights - Player Journey Visualization Tool

## Key Decisions

### 1. Browser-Side Parquet Parsing

**Decision**: Use Apache Arrow (parquet-wasm) for browser-side parquet parsing instead of server-side processing.

**Rationale**:
- Simpler deployment (no backend needed)
- Data privacy (files never leave browser)
- Faster iteration for Level Designers

**Trade-off**:
- Larger bundle size (~1MB for WASM)
- Limited to file sizes that fit in browser memory (~500MB)
- May need preprocessing for very large datasets

### 2. Konva.js vs Leaflet

**Decision**: Use Konva.js for canvas rendering instead of Leaflet.

**Rationale**:
- Minimaps are static images, not geographic tiles
- Simpler coordinate mapping (no projection complexity)
- Better performance for custom path rendering
- More control over visual styling

**Trade-off**:
- No built-in pan/zoom (can add later if needed)
- Manual coordinate transformation required

### 3. Mock Data Strategy

**Decision**: Generate realistic mock data for initial development.

**Rationale**:
- Unblocks UI development without real telemetry
- Provides schema documentation
- Allows testing edge cases

**Mock Data Schema**:
```typescript
- 48 players (12 human, 36 bot) - reflects typical match composition
- 50 events per player over ~15 minutes
- Random walk movement with event clustering
- Event types: position (91%), kills (2%), deaths (2%), loot (4%), storm_death (1%)
```

## Critical Implementation Details

### Coordinate Mapping (CRITICAL)

The coordinate transformation is the most critical part for accuracy:

```typescript
// World bounds must be verified by Level Design team
worldBounds: { minX: -5000, minY: -5000, maxX: 5000, maxY: 5000 }

// Y-axis inversion is required (game Y vs image Y)
const imageY = (1 - normalizedY) * imageHeight;
```

**Validation needed**:
- Confirm world bounds for each map
- Test with known reference points
- Verify aspect ratio matching

### Event Type Colors

Standardized color scheme for consistency:

| Event Type | Color | Hex |
|-----------|-------|-----|
| Human Player | Teal | #4ECDC4 |
| Bot Player | Red | #FF6B6B |
| Kill | Bright Red | #FF4444 |
| Death | Dark Red | #8B0000 |
| Loot | Gold | #FFD700 |
| Storm Death | Orange | #FF8C00 |
| Extract | Green | #00FF00 |

### Performance Targets

Based on typical data volumes:

- **Target**: 60fps with 50 players and 2500 events
- **Tested**: Works smoothly in Chrome/Firefox/Safari
- **Memory**: ~10MB per match (with mock data)
- **Load time**: <2 seconds for typical parquet files

## Lessons Learned

### TypeScript Strict Mode

Enabled strict mode to catch potential issues early:
- Required explicit typing for Apache Arrow table columns
- Forced null checks for optional fields
- Better IDE autocomplete

### React-Konva Integration

- Must use `react-konva` components, not raw Konva
- Event handlers need `e.cancelBubble = true` to prevent stage clicks
- Image loading requires creating `new Image()` element first

### Timeline Playback

- Use 100ms interval with speed multiplier instead of dynamic interval
- Smooth playback requires event interpolation (future enhancement)
- Loop back to start when reaching end

## Known Limitations

1. **Parquet Schema**: Currently expects specific column names (player_id, match_id, etc.)
   - Future: Add schema mapping configuration

2. **Map Configuration**: World bounds are hardcoded per map
   - Future: Create UI for Level Designers to calibrate

3. **No Persistence**: Data lost on page refresh
   - Future: Add localStorage or IndexedDB

4. **Single Match View**: Can only view one match at a time
   - Future: Add multi-match comparison view

## Next Steps

1. **Immediate**:
   - Get real parquet files from telemetry team
   - Verify coordinate transforms with real minimaps
   - Test with actual match data volumes

2. **Phase 2**:
   - Implement heatmap overlays
   - Add export to video/GIF
   - Multi-match comparison

3. **Polish**:
   - Pan/zoom on map
   - Search/filter players
   - Event detail popup on click
