// Type definitions for Chart.js to avoid bundling the library in server components
export type ChartData<T = "doughnut"> = {
  labels: string[];
  datasets: {
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
    borderWidth?: number;
  }[];
};

export type ChartOptions<T = "doughnut"> = {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: {
    legend?: {
      display?: boolean;
      position?: "top" | "bottom" | "left" | "right";
      labels?: {
        color?: string;
        font?: { size?: number };
      };
    };
    tooltip?: {
      enabled?: boolean;
      backgroundColor?: string;
      titleColor?: string;
      bodyColor?: string;
      borderColor?: string;
      borderWidth?: number;
      padding?: number;
      displayColors?: boolean;
      callbacks?: {
        label?: (context: any) => string;
        [key: string]: any;
      };
      [key: string]: any;
    };
    [key: string]: any;
  };
  cutout?: string | number;
  rotation?: number;
  circumference?: number;
  [key: string]: any;
};
