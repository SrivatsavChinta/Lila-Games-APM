/**
 * Heatmap Layer Component using heatmap.js
 * Fixed Y-axis mapping bug: uses event.y instead of event.z
 */
import React, { useEffect, useRef, useCallback } from "react";
import heatmap from "heatmap.js";
import type { MatchData, MapConfig, EventType } from "../types";

interface HeatmapLayerProps {
  mapConfig: MapConfig;
  matchData: MatchData | null;
  visibleEventTypes: EventType[];
  showBots: boolean;
  showHumans: boolean;
  currentTime: number;
  enabled: boolean;
  type: "kills" | "deaths" | "traffic" | "loot";
  containerSize: { width: number; height: number };
}

export const HeatmapLayer: React.FC<HeatmapLayerProps> = ({
  mapConfig,
  matchData,
  visibleEventTypes,
  showBots,
  showHumans,
  currentTime,
  enabled,
  type,
  containerSize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const heatmapInstanceRef = useRef<ReturnType<typeof heatmap.create> | null>(
    null,
  );

  const destroyHeatmap = useCallback(() => {
    if (heatmapInstanceRef.current && containerRef.current) {
      containerRef.current.innerHTML = "";
      heatmapInstanceRef.current = null;
    }
  }, []);

  const initHeatmap = useCallback(() => {
    if (
      !containerRef.current ||
      !enabled ||
      containerSize.width === 0 ||
      containerSize.height === 0
    ) {
      return;
    }

    destroyHeatmap();

    heatmapInstanceRef.current = heatmap.create({
      container: containerRef.current,
      radius: 30,
      maxOpacity: 0.6,
      minOpacity: 0.1,
      blur: 0.75,
      gradient: {
        0.25: "blue",
        0.55: "cyan",
        0.85: "lime",
        0.95: "yellow",
        1.0: "red",
      },
    });
  }, [enabled, containerSize.width, containerSize.height, destroyHeatmap]);

  useEffect(() => {
    if (enabled) initHeatmap();
    return () => destroyHeatmap();
  }, [enabled, initHeatmap, destroyHeatmap]);

  useEffect(() => {
    if (
      !heatmapInstanceRef.current ||
      !enabled ||
      !matchData ||
      containerSize.width === 0 ||
      containerSize.height === 0
    ) {
      return;
    }

    const events: { x: number; y: number; value: number }[] = [];

    matchData.players.forEach((player) => {
      if (player.is_bot && !showBots) return;
      if (!player.is_bot && !showHumans) return;

      player.events.forEach((event: any) => {
        if (event.timestamp > currentTime) return;

        let shouldInclude = false;
        let value = 1;

        switch (type) {
          case "kills":
            shouldInclude = event.event_type === "kill";
            value = 5;
            break;
          case "deaths":
            shouldInclude =
              event.event_type === "death" ||
              event.event_type === "storm_death";
            value = 5;
            break;
          case "loot":
            shouldInclude = event.event_type === "loot";
            value = 3;
            break;
          case "traffic":
            shouldInclude =
              event.event_type === "position" || event.event_type === "move";
            value = 1;
            break;
        }

        if (shouldInclude && visibleEventTypes.includes(event.event_type)) {
          const pixelCoords = {
            x: Math.max(
              0,
              Math.min(
                containerSize.width,
                (event.x / 1000) * containerSize.width,
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                containerSize.height,
                (event.y / 979) * containerSize.height,
              ),
            ),
          };

          events.push({
            x: Math.round(pixelCoords.x),
            y: Math.round(pixelCoords.y),
            value,
          });
        }
      });
    });

    // Group nearby points for stronger heat clusters
    const pointMap = new Map<string, number>();

    events.forEach((point) => {
      const key = `${Math.round(point.x / 5) * 5},${
        Math.round(point.y / 5) * 5
      }`;
      pointMap.set(key, (pointMap.get(key) || 0) + point.value);
    });

    const heatmapData = Array.from(pointMap.entries()).map(([key, value]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y, value };
    });

    heatmapInstanceRef.current.setData({
      max: type === "traffic" ? 20 : 10,
      data: heatmapData,
    });
  }, [
    matchData,
    visibleEventTypes,
    showBots,
    showHumans,
    currentTime,
    type,
    containerSize.width,
    containerSize.height,
    enabled,
  ]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: containerSize.width,
        height: containerSize.height,
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
};

export default HeatmapLayer;
