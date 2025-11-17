"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { ChartData, ChartOptions } from "@/types/chart";

interface DoughnutChartProps {
  data: ChartData<"doughnut">;
  options?: ChartOptions<"doughnut">;
  className?: string;
}

export function DoughnutChart({ data, options, className }: DoughnutChartProps) {
  const [Chart, setChart] = useState<ComponentType<DoughnutChartProps> | null>(null);

  useEffect(() => {
    // Dynamically import Chart.js only on client side
    import("react-chartjs-2").then((mod) => {
      import("chart.js").then((chartjs) => {
        chartjs.Chart.register(
          chartjs.ArcElement,
          chartjs.Tooltip,
          chartjs.Legend,
          chartjs.CategoryScale,
          chartjs.LinearScale
        );
        setChart(() => mod.Doughnut as ComponentType<DoughnutChartProps>);
      });
    });
  }, []);

  if (!Chart) {
    return (
      <div className={`flex items-center justify-center ${className || ""}`}>
        <div className="h-20 w-20 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  return <Chart data={data} options={options} className={className} />;
}

export default DoughnutChart;
