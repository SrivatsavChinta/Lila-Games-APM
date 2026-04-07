/**
 * Map Canvas Component using Konva
 * Renders minimap, player paths, and event markers
 */
import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text } from 'react-konva';
import Konva from 'konva';
import type { MatchData, PlayerJourney, PlayerEvent, MapConfig, EventType } from '../types';
import { worldToImage } from '../utils/coordinates';
import { HeatmapLayer } from './HeatmapLayer';

interface MapCanvasProps {
  mapConfig: MapConfig;
  matchData: MatchData | null;
  currentTime: number;
  selectedPlayerId: string | null;
  showBots: boolean;
  showHumans: boolean;
  visibleEventTypes: EventType[];
  onPlayerSelect: (playerId: string | null) => void;
  onMapClick: (worldX: number, worldY: number) => void;
  heatmapEnabled?: boolean;
  heatmapType?: 'kills' | 'deaths' | 'traffic' | 'loot';
}

// Color scheme for different event types
const EVENT_COLORS: Record<EventType, string> = {
  position: '#4ECDC4', // Teal (default)
  kill: '#FF4444', // Red
  death: '#8B0000', // Dark red
  loot: '#FFD700', // Gold
  storm_death: '#FF8C00', // Orange
  extract: '#00FF00', // Green
};

const PLAYER_COLORS = {
  human: '#4ECDC4',
  bot: '#FF6B6B',
};

export const MapCanvas: React.FC<MapCanvasProps> = ({
  mapConfig,
  matchData,
  currentTime,
  selectedPlayerId,
  showBots,
  showHumans,
  visibleEventTypes,
  onPlayerSelect,
  onMapClick,
  heatmapEnabled = false,
  heatmapType = 'kills',
}) => {
  const [minimapImage, setMinimapImage] = useState<HTMLImageElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load minimap image
  useEffect(() => {
    const img = new Image();
    img.src = mapConfig.imageUrl;
    img.onload = () => {
      setMinimapImage(img);
    };
    img.onerror = () => {
      console.warn(`Failed to load minimap: ${mapConfig.imageUrl}`);
    };
  }, [mapConfig.imageUrl]);

  // Track container size for proper heatmap alignment
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateSize();

    // Use ResizeObserver for precise size tracking
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Calculate the actual rendered size of the map image
  // This ensures the heatmap aligns exactly with the visible map
  const getMapRenderSize = () => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { width: 0, height: 0, scale: 1, offsetX: 0, offsetY: 0 };
    }

    const scaleX = containerSize.width / mapConfig.imageWidth;
    const scaleY = containerSize.height / mapConfig.imageHeight;
    const scale = Math.min(scaleX, scaleY);

    const renderWidth = mapConfig.imageWidth * scale;
    const renderHeight = mapConfig.imageHeight * scale;

    // Calculate centering offsets (if map is letterboxed)
    const offsetX = (containerSize.width - renderWidth) / 2;
    const offsetY = (containerSize.height - renderHeight) / 2;

    return { width: renderWidth, height: renderHeight, scale, offsetX, offsetY };
  };

  const mapRenderSize = getMapRenderSize();

  // Filter visible players
  const visiblePlayers = matchData?.players.filter((p) => {
    if (p.is_bot && !showBots) return false;
    if (!p.is_bot && !showHumans) return false;
    return true;
  }) || [];

  // Get events up to current time
  const getPlayerPath = (player: PlayerJourney): number[] => {
    const points: number[] = [];
    for (const event of player.events) {
      if (event.timestamp > currentTime) break;
      if (event.event_type !== 'position' && !visibleEventTypes.includes(event.event_type)) continue;

      const imgCoords = worldToImage(event.x, event.y, mapConfig);
      // Scale to rendered size and add offset
      const renderX = imgCoords.x * mapRenderSize.scale + mapRenderSize.offsetX;
      const renderY = imgCoords.y * mapRenderSize.scale + mapRenderSize.offsetY;
      points.push(renderX, renderY);
    }
    return points;
  };

  // Get visible event markers
  const getEventMarkers = (player: PlayerJourney): PlayerEvent[] => {
    return player.events.filter(
      (e) =>
        e.timestamp <= currentTime &&
        visibleEventTypes.includes(e.event_type) &&
        e.event_type !== 'position'
    );
  };

  // Handle stage click
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Transform to image coordinates (subtract offset, divide by scale)
    const imageX = (pos.x - mapRenderSize.offsetX) / mapRenderSize.scale;
    const imageY = (pos.y - mapRenderSize.offsetY) / mapRenderSize.scale;

    // Transform to world coordinates
    const normalizedX = imageX / mapConfig.imageWidth;
    const normalizedY = 1 - imageY / mapConfig.imageHeight;
    const worldX =
      mapConfig.worldBounds.minX +
      normalizedX * (mapConfig.worldBounds.maxX - mapConfig.worldBounds.minX);
    const worldY =
      mapConfig.worldBounds.minY +
      normalizedY * (mapConfig.worldBounds.maxY - mapConfig.worldBounds.minY);

    onMapClick(worldX, worldY);
  };

  // Get current position for a player (for highlighting)
  const getPlayerCurrentPosition = (player: PlayerJourney): { x: number; y: number } | null => {
    const event = player.events.find((e) => e.timestamp <= currentTime);
    if (!event) return null;
    const imgCoords = worldToImage(event.x, event.y, mapConfig);
    return {
      x: imgCoords.x * mapRenderSize.scale + mapRenderSize.offsetX,
      y: imgCoords.y * mapRenderSize.scale + mapRenderSize.offsetY,
    };
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a1a',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Heatmap layer - positioned absolutely to match map container */}
      <HeatmapLayer
        mapConfig={mapConfig}
        matchData={matchData}
        visibleEventTypes={visibleEventTypes}
        showBots={showBots}
        showHumans={showHumans}
        currentTime={currentTime}
        enabled={heatmapEnabled}
        type={heatmapType}
        containerSize={containerSize}
      />

      {/* Konva Stage for map rendering */}
      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        onClick={handleStageClick}
        style={{ cursor: 'crosshair', position: 'relative', zIndex: 20 }}
      >
        <Layer>
          {/* Minimap background - centered in container */}
          {minimapImage && (
            <KonvaImage
              image={minimapImage}
              x={mapRenderSize.offsetX}
              y={mapRenderSize.offsetY}
              width={mapRenderSize.width}
              height={mapRenderSize.height}
              opacity={0.8}
            />
          )}

          {/* Player paths */}
          {visiblePlayers.map((player) => {
            const path = getPlayerPath(player);
            if (path.length < 4) return null;

            const isSelected = player.player_id === selectedPlayerId;
            const color = player.is_bot ? PLAYER_COLORS.bot : PLAYER_COLORS.human;

            return (
              <React.Fragment key={player.player_id}>
                <Line
                  points={path}
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 1}
                  opacity={isSelected ? 1 : 0.6}
                  listening={false}
                />
              </React.Fragment>
            );
          })}

          {/* Event markers */}
          {visiblePlayers.map((player) => {
            const markers = getEventMarkers(player);
            return markers.map((event, idx) => {
              const pos = worldToImage(event.x, event.y, mapConfig);
              const color = EVENT_COLORS[event.event_type];
              const isSelected = player.player_id === selectedPlayerId;
              const renderX = pos.x * mapRenderSize.scale + mapRenderSize.offsetX;
              const renderY = pos.y * mapRenderSize.scale + mapRenderSize.offsetY;

              return (
                <Circle
                  key={`${player.player_id}_${idx}`}
                  x={renderX}
                  y={renderY}
                  radius={isSelected ? 8 : 5}
                  fill={color}
                  stroke={isSelected ? '#FFFFFF' : 'transparent'}
                  strokeWidth={2}
                  opacity={0.8}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onPlayerSelect(player.player_id);
                  }}
                />
              );
            });
          })}

          {/* Player current position indicators */}
          {visiblePlayers.map((player) => {
            const pos = getPlayerCurrentPosition(player);
            if (!pos) return null;

            const isSelected = player.player_id === selectedPlayerId;
            const color = player.is_bot ? PLAYER_COLORS.bot : PLAYER_COLORS.human;

            return (
              <React.Fragment key={`pos_${player.player_id}`}>
                <Circle
                  x={pos.x}
                  y={pos.y}
                  radius={isSelected ? 12 : 6}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 3 : 1}
                  opacity={0.9}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onPlayerSelect(player.player_id);
                  }}
                />
                {isSelected && (
                  <Text
                    x={pos.x + 15}
                    y={pos.y - 10}
                    text={player.player_id}
                    fontSize={14}
                    fill="#FFFFFF"
                    stroke="#000000"
                    strokeWidth={0.5}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};

export default MapCanvas;
