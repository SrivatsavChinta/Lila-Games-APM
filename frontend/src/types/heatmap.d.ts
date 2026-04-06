declare module 'heatmap.js' {
  interface HeatmapDataPoint {
    x: number;
    y: number;
    value: number;
  }

  interface HeatmapData {
    max: number;
    data: HeatmapDataPoint[];
  }

  interface HeatmapConfig {
    container: HTMLElement;
    radius?: number;
    maxOpacity?: number;
    minOpacity?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  interface HeatmapInstance {
    setData(data: HeatmapData): void;
    addData(data: HeatmapDataPoint | HeatmapDataPoint[]): void;
    removeData(): void;
    setMax(max: number): void;
    destroy(): void;
  }

  function create(config: HeatmapConfig): HeatmapInstance;

  export default {
    create,
  };
}
