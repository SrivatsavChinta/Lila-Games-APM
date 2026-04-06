/**
 * Heatmap Layer Component using heatmap.js
 * Renders heatmap overlay synced with the map
 */
import React, { useEffect, useRef, useState } from 'react';
import heatmap from 'heatmap.js';
import type { MatchData, MapConfig, EventType } from '../types';
import { worldToImage } from '../utils/coordinates';

interface HeatmapLayerProps {
  mapConfig: MapConfig;
  matchData: MatchData | null;
  visibleEventTypes: EventType[];
  showBots: boolean;
  showHumans: boolean;
  currentTime: number;
  enabled: boolean;
  type: 'kills' | 'deaths' | 'traffic' | 'loot';
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const heatmapInstanceRef = useRef<ReturnType<typeof heatmap.create> | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Calculate container size based on map dimensions and scale
  useEffect(() => {
    if (!containerRef.current) return;

    const parent = containerRef.current.parentElement;
    if (!parent) return;

    const updateSize = () => {
      const parentWidth = parent.offsetWidth - 32; // Account for padding
      const parentHeight = parent.offsetHeight - 32;

      const scaleX = parentWidth / mapConfig.imageWidth;
      const scaleY = parentHeight / mapConfig.imageHeight;
      const scale = Math.min(scaleX, scaleY);

      setContainerSize({
        width: mapConfig.imageWidth * scale,
        height: mapConfig.imageHeight * scale,
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [mapConfig.imageWidth, mapConfig.imageHeight]);

  // Initialize heatmap instance
  useEffect(() => {
    if (!containerRef.current || !enabled || containerSize.width === 0) return;

    // Clean up existing instance
    if (heatmapInstanceRef.current) {
      heatmapInstanceRef.current = null;
      containerRef.current.innerHTML = '';
    }

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

    return () => {
      containerRef.current!.innerHTML = '';
      heatmapInstanceRef.current = null;
    };
  }, [enabled, containerSize.width, containerSize.height]);

  // Update heatmap data when events change
  useEffect(() => {
    if (!heatmapInstanceRef.current || !enabled || !matchData) return;

    const scale = containerSize.width / mapConfig.imageWidth;

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
          const imgCoords = worldToImage(event.x, event.y, mapConfig);
          events.push({
            x: Math.round(imgCoords.x * scale),
            y: Math.round(imgCoords.y * scale),
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
    enabled,
  ]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: containerSize.width,
        height: containerSize.height,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
};

export default HeatmapLayer;
