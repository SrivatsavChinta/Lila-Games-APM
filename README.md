# LILA BLACK - Player Journey Visualization Tool

🔗 **Live Demo:** https://lila-games-apm.vercel.app/  
📄 **Checkout the drive link for documents:** https://bit.ly/4sQvKJ6

A browser-based telemetry visualization tool for Lila Games' extraction shooter **LILA BLACK**.

---

## Overview

This tool allows Level Designers to explore player behavior on game maps by visualizing:

- Player movement paths (humans vs bots)
- Event markers (kills, deaths, loot pickups, storm deaths, extracts)
- Match timelines with playback controls
- Heatmap overlays (Phase 2)

---

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript
- **Parquet Parsing:** Apache Arrow (browser-side)
- **Canvas Rendering:** Konva.js
- **Heatmap:** heatmap.js (Phase 2)
- **Hosting:** Vercel

---

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` to view the app.

---

## Project Structure

```text
player-viz-tool/
├── frontend/                    # React application
│   ├── src/
│   │   ├── types.ts            # Core TypeScript types
│   │   ├── utils/
│   │   │   ├── dataLoader.ts  # Parquet + mock data
│   │   │   └── coordinates.ts # World/image coord transforms
│   │   ├── components/
│   │   │   └── MapCanvas.tsx  # Konva map renderer
│   │   └── App.tsx            # Main application
│   └── package.json
├── backend/                    # Optional Python utilities
├── data/                       # Minimap images + parquet files (gitignored)
├── ARCHITECTURE.md            # System design docs
├── INSIGHTS.md                # Development learnings
└── README.md
```

---

## Features

### Implemented (MVP)

- [x] Mock data generation for testing
- [x] World coordinate to image coordinate mapping
- [x] Player path visualization (humans: teal, bots: red)
- [x] Event markers (kills, deaths, loot, storm deaths, extracts)
- [x] Match/player filtering
- [x] Timeline with playback controls
- [x] Player selection and highlighting

### Phase 2

- [ ] Parquet file upload
- [ ] Heatmap overlays
- [ ] Multiple match comparison
- [ ] Export to video/GIF

---

## Data Format

The tool expects telemetry data with the following schema:

```typescript
interface PlayerEvent {
  player_id: string;
  match_id: string;
  map_id: string;
  timestamp: number; // Unix timestamp (ms)
  x: number; // World X coordinate
  y: number; // World Y coordinate
  event_type:
    | "position"
    | "kill"
    | "death"
    | "loot"
    | "storm_death"
    | "extract";
  is_bot: boolean;
}
```

---

## Coordinate System

**Critical:** Coordinate mapping is essential for accuracy.

World coordinates are mapped to image coordinates using linear scaling:

- World bounds: Defined per map (e.g., -5000 to 5000)
- Image bounds: Minimap pixel dimensions
- Y-axis is inverted (world Y up = image Y down)

See `frontend/src/utils/coordinates.ts` for implementation.

---

## Adding Real Minimaps

1. Add minimap images to `frontend/public/maps/`
2. Update `DEFAULT_MAP_CONFIGS` in `frontend/src/utils/coordinates.ts`
   - `map_id`: Match with telemetry data
   - `imageUrl`: Path to minimap
   - `worldBounds`: Get from Level Design team
   - `imageWidth/Height`: Minimap dimensions

---

## Deployment

The app is configured for Vercel deployment:

```bash
npm run build
# Deploy frontend/dist to Vercel
```

---
