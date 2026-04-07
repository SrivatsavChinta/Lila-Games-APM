/**
 * Player Journey Visualization Tool
 * Lila Games - LILA BLACK
 *
 * Main application component with state management
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import type {
  MatchData,
  EventType,
  FilterState,
  TimelineState,
} from './types';
import { MapCanvas } from './components/MapCanvas';
import { ToastContainer, type ToastMessage } from './components/Toast';
import {
  generateMockData,
  generateMultipleMatches,
  loadParquetFile,
  processEventsIntoMatches,
} from './utils/dataLoader';
import { DEFAULT_MAP_CONFIGS, getMapConfig } from './utils/coordinates';

// Event type filters
const EVENT_TYPE_OPTIONS: { type: EventType; label: string; color: string }[] =
  [
    { type: 'position', label: 'Movement', color: '#4ECDC4' },
    { type: 'kill', label: 'Kills', color: '#FF4444' },
    { type: 'death', label: 'Deaths', color: '#8B0000' },
    { type: 'loot', label: 'Loot', color: '#FFD700' },
    { type: 'storm_death', label: 'Storm Deaths', color: '#FF8C00' },
    { type: 'extract', label: 'Extracts', color: '#00FF00' },
  ];

function App() {
  // State
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string>('AmbroseValley');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    mapId: null,
    startDate: null,
    endDate: null,
    matchId: null,
    showBots: true,
    showHumans: true,
    eventTypes: ['position', 'kill', 'death', 'loot', 'storm_death', 'extract'],
  });

  // Timeline
  const [timeline, setTimeline] = useState<TimelineState>({
    currentTime: 0,
    isPlaying: false,
    playbackSpeed: 1,
    startTime: 0,
    endTime: 0,
  });

  // Heatmap
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [heatmapType, setHeatmapType] = useState<'kills' | 'deaths' | 'traffic' | 'loot'>('kills');

  // Toast helper
  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Get current match
  const currentMatch = useMemo(() => {
    if (!selectedMatchId) return matches[0] || null;
    return matches.find((m) => m.match_id === selectedMatchId) || null;
  }, [matches, selectedMatchId]);

  // Get current map config
  const currentMapConfig = useMemo(() => {
    if (currentMatch) {
      const config = getMapConfig(currentMatch.map_id);
      if (config) return config;
    }
    return getMapConfig(selectedMapId) || DEFAULT_MAP_CONFIGS[0];
  }, [currentMatch, selectedMapId]);

  // Load mock data on mount
  useEffect(() => {
    const mockData = generateMockData('AmbroseValley');
    setMatches([mockData]);
    setSelectedMatchId(mockData.match_id);
    setSelectedMapId(mockData.map_id);

    // Initialize timeline
    setTimeline({
      currentTime: mockData.startTime,
      isPlaying: false,
      playbackSpeed: 1,
      startTime: mockData.startTime,
      endTime: mockData.endTime,
    });

    addToast('success', `Mock data loaded — ${mockData.allEvents.length} events across 1 match on Ambrose Valley`);
  }, [addToast]);

  // Playback animation
  useEffect(() => {
    if (!timeline.isPlaying || !currentMatch) return;

    const interval = setInterval(() => {
      setTimeline((prev) => {
        const newTime =
          prev.currentTime + 1000 * prev.playbackSpeed;
        if (newTime >= prev.endTime) {
          return { ...prev, currentTime: prev.startTime };
        }
        return { ...prev, currentTime: newTime };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [timeline.isPlaying, timeline.playbackSpeed, currentMatch]);

  // File upload handler
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      setError(null);
      const loadingToastId = addToast('loading', 'Parsing parquet file...');

      try {
        const events = await loadParquetFile(file);
        const newMatches = processEventsIntoMatches(events);

        // Remove loading toast
        removeToast(loadingToastId);

        setMatches((prev) => [...prev, ...newMatches]);

        if (newMatches.length > 0) {
          if (!selectedMatchId) {
            setSelectedMatchId(newMatches[0].match_id);
          }

          const totalEvents = newMatches.reduce((sum, m) => sum + m.allEvents.length, 0);
          addToast('success', `File uploaded successfully — ${totalEvents} events loaded across ${newMatches.length} match${newMatches.length > 1 ? 'es' : ''}`);
        }
      } catch (err) {
        removeToast(loadingToastId);
        const errorMsg = `Failed to read file — make sure it is a valid .parquet file`;
        setError(errorMsg);
        addToast('error', errorMsg);
      } finally {
        setIsLoading(false);
        // Reset file input
        event.target.value = '';
      }
    },
    [selectedMatchId, addToast, removeToast]
  );

  // Generate new mock data
  const handleGenerateMock = useCallback(() => {
    const mockMatches = generateMultipleMatches(selectedMapId, 2 + Math.floor(Math.random() * 2)); // 2-3 matches

    setMatches((prev) => [...prev, ...mockMatches]);

    // Auto-select the first new match
    if (mockMatches.length > 0) {
      setSelectedMatchId(mockMatches[0].match_id);
    }

    const totalEvents = mockMatches.reduce((sum, m) => sum + m.allEvents.length, 0);
    const mapName = DEFAULT_MAP_CONFIGS.find(m => m.map_id === selectedMapId)?.name || selectedMapId;

    addToast('success', `Mock data generated — ${totalEvents} events across ${mockMatches.length} matches on ${mapName}`);
  }, [selectedMapId, addToast]);

  // Timeline controls
  const handlePlayPause = () => {
    setTimeline((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const handleSeek = (newTime: number) => {
    setTimeline((prev) => ({
      ...prev,
      currentTime: Math.max(prev.startTime, Math.min(prev.endTime, newTime)),
    }));
  };

  // Format time display
  const formatTime = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60000);
    const seconds = Math.floor((timestamp % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate timeline progress
  const timelineProgress = useMemo(() => {
    if (timeline.endTime === timeline.startTime) return 0;
    return (
      ((timeline.currentTime - timeline.startTime) /
        (timeline.endTime - timeline.startTime)) *
      100
    );
  }, [timeline]);

  return (
    <div className="app">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header */}
      <header className="app-header">
        <h1>LILA BLACK - Player Journey Visualizer</h1>
        <div className="header-actions">
          <label className={`file-upload ${isLoading ? 'loading' : ''}`}>
            <input
              type="file"
              accept=".parquet,.arrow"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
            {isLoading ? 'Parsing...' : 'Upload Parquet'}
          </label>
          <button
            onClick={handleGenerateMock}
            className="btn-secondary"
            disabled={isLoading}
          >
            Generate Mock Data
          </button>
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          {/* Match selector */}
          <section className="panel">
            <h3>Match</h3>
            <select
              value={selectedMatchId || ''}
              onChange={(e) => setSelectedMatchId(e.target.value || null)}
            >
              {matches.map((m) => (
                <option key={m.match_id} value={m.match_id}>
                  {m.match_id.slice(0, 8)}... ({m.players.length} players, {m.allEvents.length} events)
                </option>
              ))}
            </select>
          </section>

          {/* Map selector */}
          <section className="panel">
            <h3>Map</h3>
            <select
              value={currentMapConfig.map_id}
              onChange={(e) => setSelectedMapId(e.target.value)}
            >
              {DEFAULT_MAP_CONFIGS.map((m) => (
                <option key={m.map_id} value={m.map_id}>
                  {m.name}
                </option>
              ))}
            </select>
          </section>

          {/* Player filters */}
          <section className="panel">
            <h3>Player Types</h3>
            <label>
              <input
                type="checkbox"
                checked={filters.showHumans}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, showHumans: e.target.checked }))
                }
              />
              Humans
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.showBots}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, showBots: e.target.checked }))
                }
              />
              Bots
            </label>
          </section>

          {/* Event type filters */}
          <section className="panel">
            <h3>Event Types</h3>
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <label key={opt.type} className="event-filter">
                <input
                  type="checkbox"
                  checked={filters.eventTypes.includes(opt.type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFilters((f) => ({
                        ...f,
                        eventTypes: [...f.eventTypes, opt.type],
                      }));
                    } else {
                      setFilters((f) => ({
                        ...f,
                        eventTypes: f.eventTypes.filter((t) => t !== opt.type),
                      }));
                    }
                  }}
                />
                <span
                  className="color-dot"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
              </label>
            ))}
          </section>

          {/* Heatmap controls */}
          <section className="panel">
            <h3>Heatmap</h3>
            <label>
              <input
                type="checkbox"
                checked={heatmapEnabled}
                onChange={(e) => setHeatmapEnabled(e.target.checked)}
              />
              Show Heatmap
            </label>
            <select
              value={heatmapType}
              onChange={(e) => setHeatmapType(e.target.value as typeof heatmapType)}
              disabled={!heatmapEnabled}
              style={{ marginTop: '8px' }}
            >
              <option value="kills">Kills</option>
              <option value="deaths">Deaths</option>
              <option value="loot">Loot</option>
              <option value="traffic">Traffic</option>
            </select>
          </section>

          {/* Player list */}
          {currentMatch && (
            <section className="panel player-list">
              <h3>Players ({currentMatch.players.length})</h3>
              <ul>
                {currentMatch.players.map((p) => (
                  <li
                    key={p.player_id}
                    className={
                      selectedPlayerId === p.player_id ? 'selected' : ''
                    }
                    onClick={() =>
                      setSelectedPlayerId(
                        selectedPlayerId === p.player_id ? null : p.player_id
                      )
                    }
                  >
                    <span
                      className={`player-type ${p.is_bot ? 'bot' : 'human'}`}
                    />
                    {p.is_bot ? `Bot ${p.player_id.slice(-4)}` : `Player ${p.player_id.slice(0, 8)}`}
                    <span className="event-count">
                      ({p.events.length} events)
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Match stats */}
          {currentMatch && (
            <section className="panel stats">
              <h3>Match Stats</h3>
              <div className="stat-row">
                <span>Total Events:</span>
                <span>{currentMatch.allEvents.length}</span>
              </div>
              <div className="stat-row">
                <span>Duration:</span>
                <span>
                  {(
                    (currentMatch.endTime - currentMatch.startTime) /
                    1000 /
                    60
                  ).toFixed(1)}
                  m
                </span>
              </div>
              <div className="stat-row">
                <span>Kills:</span>
                <span>
                  {
                    currentMatch.allEvents.filter((e) => e.event_type === 'kill')
                      .length
                  }
                </span>
              </div>
              <div className="stat-row">
                <span>Deaths:</span>
                <span>
                  {
                    currentMatch.allEvents.filter((e) => e.event_type === 'death' || e.event_type === 'storm_death')
                      .length
                  }
                </span>
              </div>
            </section>
          )}
        </aside>

        {/* Main content */}
        <main className="main-content">
          <div className="map-container">
            <MapCanvas
              mapConfig={currentMapConfig}
              matchData={currentMatch}
              currentTime={timeline.currentTime}
              selectedPlayerId={selectedPlayerId}
              showBots={filters.showBots}
              showHumans={filters.showHumans}
              visibleEventTypes={filters.eventTypes}
              onPlayerSelect={setSelectedPlayerId}
              onMapClick={(x, y) => console.log('Map clicked:', { x, y })}
              heatmapEnabled={heatmapEnabled}
              heatmapType={heatmapType}
            />
          </div>

          {/* Timeline controls */}
          <div className="timeline-panel">
            <button
              className="play-btn"
              onClick={handlePlayPause}
              aria-label={timeline.isPlaying ? 'Pause' : 'Play'}
            >
              {timeline.isPlaying ? '⏸' : '▶'}
            </button>

            <div className="timeline-slider">
              <input
                type="range"
                min={timeline.startTime}
                max={timeline.endTime}
                value={timeline.currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                style={{
                  background: `linear-gradient(to right, #4ECDC4 0%, #4ECDC4 ${timelineProgress}%, #333 ${timelineProgress}%, #333 100%)`,
                }}
              />
              <div className="timeline-labels">
                <span>{formatTime(timeline.startTime)}</span>
                <span>{formatTime(timeline.currentTime)}</span>
                <span>{formatTime(timeline.endTime)}</span>
              </div>
            </div>

            <div className="timeline-speed">
              <label>Speed:</label>
              <select
                value={timeline.playbackSpeed}
                onChange={(e) =>
                  setTimeline((t) => ({
                    ...t,
                    playbackSpeed: Number(e.target.value),
                  }))
                }
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
              </select>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
