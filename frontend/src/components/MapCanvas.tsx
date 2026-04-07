/**
 * Map Canvas Component using Konva
 *
 * COORDINATE SYSTEM:
 *   event.x = x_coord (0-1000) → pixel_x = (x/1000) * containerWidth
 *   event.y = y_coord (0-979)  → pixel_y = (y/979)  * containerHeight
 *   event.z = unused (always 0)
 *
 * NO world coordinate formula applied — coords are already normalized.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Line,
  Circle,
  Text,
} from "react-konva";
import Konva from "konva";
import type {
  MatchData,
  PlayerJourney,
  PlayerEvent,
  MapConfig,
  EventType,
} from "../types";
import { HeatmapLayer } from "./HeatmapLayer";

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
  heatmapType?: "kills" | "deaths" | "traffic" | "loot";
}

const EVENT_COLORS: Record<EventType, string> = {
  position: "#4ECDC4",
  kill: "#FF4444",
  death: "#8B0000",
  loot: "#FFD700",
  storm_death: "#FF8C00",
  extract: "#00FF00",
};

const PLAYER_COLORS = {
  human: "#4ECDC4",
  bot: "#FF6B6B",
};

// Convert event coords (x: 0-1000, y: 0-979) to canvas pixels
function eventToPixel(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: (x / 1000) * width,
    y: (y / 979) * height,
  };
}

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
  heatmapType = "kills",
}) => {
  const [minimapImage, setMinimapImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load minimap image
  useEffect(() => {
    const img = new Image();
    img.src = mapConfig.imageUrl;
    img.onload = () => setMinimapImage(img);
    img.onerror = () =>
      console.warn(`Failed to load minimap: ${mapConfig.imageUrl}`);
  }, [mapConfig.imageUrl]);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    window.addEventListener("resize", updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  // event.x (0-1000) and event.y (0-979) → canvas pixels
  const toPixel = useCallback(
    (x: number, y: number) =>
      eventToPixel(x, y, containerSize.width, containerSize.height),
    [containerSize.width, containerSize.height],
  );

  const visiblePlayers =
    matchData?.players.filter((p) => {
      if (p.is_bot && !showBots) return false;
      if (!p.is_bot && !showHumans) return false;
      return true;
    }) ?? [];

  // Build path points up to currentTime
  // Uses event.x and event.y — NOT event.z
  const getPlayerPath = (player: PlayerJourney): number[] => {
    const points: number[] = [];
    for (const event of player.events) {
      if (event.timestamp > currentTime) break;
      if (
        event.event_type !== "position" &&
        !visibleEventTypes.includes(event.event_type)
      )
        continue;

      const px = toPixel(event.x, event.y); // ✅ x and y
      points.push(px.x, px.y);
    }
    return points;
  };

  const getEventMarkers = (player: PlayerJourney): PlayerEvent[] =>
    player.events.filter(
      (e) =>
        e.timestamp <= currentTime &&
        visibleEventTypes.includes(e.event_type) &&
        e.event_type !== "position",
    );

  const getPlayerCurrentPosition = (
    player: PlayerJourney,
  ): { x: number; y: number } | null => {
    const past = player.events.filter((e) => e.timestamp <= currentTime);
    if (past.length === 0) return null;
    const last = past[past.length - 1];
    return toPixel(last.x, last.y); // ✅ x and y
  };

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    // Pass back normalized coords
    onMapClick(
      (pos.x / containerSize.width) * 1000,
      (pos.y / containerSize.height) * 979,
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#1a1a1a",
        position: "relative",
        overflow: "hidden",
      }}
    >
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

      <Stage
        ref={stageRef}
        width={containerSize.width}
        height={containerSize.height}
        onClick={handleStageClick}
        style={{
          cursor: "crosshair",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 20,
        }}
      >
        <Layer>
          {minimapImage &&
            containerSize.width > 0 &&
            containerSize.height > 0 && (
              <KonvaImage
                image={minimapImage}
                x={0}
                y={0}
                width={containerSize.width}
                height={containerSize.height}
                opacity={1}
              />
            )}

          {/* Player paths */}
          {visiblePlayers.map((player) => {
            const path = getPlayerPath(player);
            if (path.length < 4) return null;
            const isSelected = player.player_id === selectedPlayerId;
            const color = player.is_bot
              ? PLAYER_COLORS.bot
              : PLAYER_COLORS.human;
            return (
              <Line
                key={`path_${player.player_id}`}
                points={path}
                stroke={color}
                strokeWidth={isSelected ? 3 : 1}
                opacity={isSelected ? 1 : 0.6}
                listening={false}
              />
            );
          })}

          {/* Event markers */}
          {visiblePlayers.map((player) =>
            getEventMarkers(player).map((event, idx) => {
              const pos = toPixel(event.x, event.y); // ✅ x and y
              const color = EVENT_COLORS[event.event_type];
              const isSelected = player.player_id === selectedPlayerId;
              return (
                <Circle
                  key={`${player.player_id}_${idx}`}
                  x={pos.x}
                  y={pos.y}
                  radius={isSelected ? 8 : 5}
                  fill={color}
                  stroke={isSelected ? "#FFFFFF" : "transparent"}
                  strokeWidth={2}
                  opacity={0.9}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onPlayerSelect(player.player_id);
                  }}
                />
              );
            }),
          )}

          {/* Current position indicators */}
          {visiblePlayers.map((player) => {
            const pos = getPlayerCurrentPosition(player);
            if (!pos) return null;
            const isSelected = player.player_id === selectedPlayerId;
            const color = player.is_bot
              ? PLAYER_COLORS.bot
              : PLAYER_COLORS.human;
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
                    text={player.player_id.slice(0, 8)}
                    fontSize={12}
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
