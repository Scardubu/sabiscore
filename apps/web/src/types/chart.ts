import type { ChartData as ChartJSData, ChartOptions as ChartJSOptions, ChartType } from "chart.js";

// Re-export Chart.js types so server components can reference them without direct runtime imports
export type ChartData<T extends ChartType = "doughnut"> = ChartJSData<T>;
export type ChartOptions<T extends ChartType = "doughnut"> = ChartJSOptions<T>;
