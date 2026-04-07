/**
 * Heatmap Layer Component using heatmap.js
 * Renders heatmap overlay synced with the map
 *
 * CRITICAL: The heatmap canvas must ALWAYS match the map container's
 * actual rendered dimensions exactly. Uses position: absolute for overlay.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import heatmap from 'heatmap.js';
import type { MatchData, MapConfig, EventType } from '../types';
import { worldToImage, getMapRenderDimensions } from '../utils/coordinates';

interface HeatmapLayerProps {
  mapConfig: MapConfig;
  matchData: MatchData | null;
  visibleEventTypes: EventType[];
  showBots: boolean;
  showHumans: boolean;
  currentTime: number;
  enabled: boolean;
  type: 'kills' | 'deaths' | 'traffic' | 'loot';
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
  const heatmapInstanceRef = useRef<ReturnType<typeof heatmap.create> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Calculate actual map render dimensions within the container
  const getRenderDimensions = useCallback(() => {
    return getMapRenderDimensions(
      containerSize.width,
      containerSize.height,
      mapConfig.imageWidth,
      mapConfig.imageHeight
    );
  }, [containerSize.width, containerSize.height, mapConfig.imageWidth, mapConfig.imageHeight]);

  // Destroy existing heatmap instance
  const destroyHeatmap = useCallback(() => {
    if (heatmapInstanceRef.current && containerRef.current) {
      // Clear the container
      containerRef.current.innerHTML = '';
      heatmapInstanceRef.current = null;
      canvasRef.current = null;
    }
  }, []);

  // Initialize heatmap instance
  const initHeatmap = useCallback(() => {
    if (!containerRef.current || !enabled || containerSize.width === 0 || containerSize.height === 0) {
      return;
    }

    // Clean up existing instance
    destroyHeatmap();

    const instance = heatmap.create({
      container: containerRef.current,
      radius: 30,
      maxOpacity: 0.6,
      minOpacity: 0.1,
      blur: 0.75,
      gradient: {
        0.25: 'blue',
        0.55: 'cyan',
        0.85: 'lime',
        0.95: 'yellow',
        1.0: 'red',
      },
    });

    heatmapInstanceRef.current = instance;

    // Store reference to the canvas element
    const canvas = containerRef.current.querySelector('canvas');
    if (canvas) {
      canvasRef.current = canvas as HTMLCanvasElement;
    }
  }, [enabled, containerSize.width, containerSize.height, destroyHeatmap]);

  // Initialize heatmap when enabled or container size changes
  useEffect(() => {
    if (enabled) {
      initHeatmap();
    }
    return () => {
      if (!enabled) {
        destroyHeatmap();
      }
    };
  }, [enabled, initHeatmap, destroyHeatmap]);

  // Update heatmap canvas dimensions to match container
  useEffect(() => {
    if (!canvasRef.current || !enabled) return;

    const { offsetX, offsetY } = getRenderDimensions();

    // Set canvas dimensions to match the actual render size
    // The canvas needs to be the full container size so we can position it correctly
    canvasRef.current.width = containerSize.width;
    canvasRef.current.height = containerSize.height;
    canvasRef.current.style.width = `${containerSize.width}px`;
    canvasRef.current.style.height = `${containerSize.height}px`;

    // Store offset for coordinate calculation
    canvasRef.current.dataset.offsetX = String(offsetX);
    canvasRef.current.dataset.offsetY = String(offsetY);
  }, [containerSize.width, containerSize.height, enabled, getRenderDimensions]);

  // Update heatmap data when events change
  useEffect(() => {
    if (!heatmapInstanceRef.current || !enabled || !matchData || containerSize.width === 0) {
      return;
    }

    const renderDims = getRenderDimensions();
    const { offsetX, offsetY, scale } = renderDims;

    // Scale factor from image coordinates to render coordinates
    const scaleX = scale;
    const scaleY = scale;

    // Filter events based on type and visibility
    const events: { x: number; y: number; value: number }[] = [];

    matchData.players.forEach((player) => {
      // Skip if player type is filtered out
      if (player.is_bot && !showBots) return;
      if (!player.is_bot && !showHumans) return;

      player.events.forEach((event) => {
        // Only include events up to current time
        if (event.timestamp > currentTime) return;

        // Filter by event type based on heatmap type
        let shouldInclude = false;
        let value = 1;

        switch (type) {
          case 'kills':
            shouldInclude = event.event_type === 'kill';
            value = 5;
            break;
          case 'deaths':
            shouldInclude = event.event_type === 'death' || event.event_type === 'storm_death';
            value = 5;
            break;
          case 'loot':
            shouldInclude = event.event_type === 'loot';
            value = 3;
            break;
          case 'traffic':
            shouldInclude = event.event_type === 'position';
            value = 1;
            break;
        }

        if (shouldInclude && visibleEventTypes.includes(event.event_type)) {
          // Convert world to image coordinates
          const imgCoords = worldToImage(event.x, event.y, mapConfig);

          // Convert image coordinates to render coordinates (add offset)
          const renderX = imgCoords.x * scaleX + offsetX;
          const renderY = imgCoords.y * scaleY + offsetY;

          events.push({
            x: Math.round(renderX),
            y: Math.round(renderY),
            value,
          });
        }
      });
    });

    // Group nearby points to improve performance and visual quality
    const pointMap = new Map<string, number>();
    events.forEach((point) => {
      // Round to nearest 5 pixels to group nearby points
      const key = `${Math.round(point.x / 5) * 5},${Math.round(point.y / 5) * 5}`;
      pointMap.set(key, (pointMap.get(key) || 0) + point.value);
    });

    const heatmapData = Array.from(pointMap.entries()).map(([key, value]) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, value };
    });

    heatmapInstanceRef.current.setData({
      max: type === 'traffic' ? 20 : 10,
      data: heatmapData,
    });
  }, [
    matchData,
    visibleEventTypes,
    showBots,
    showHumans,
    currentTime,
    type,
    mapConfig,
    containerSize.width,
    containerSize.height,
    enabled,
    getRenderDimensions,
  ]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerSize.width,
        height: containerSize.height,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
};

export default HeatmapLayer;
