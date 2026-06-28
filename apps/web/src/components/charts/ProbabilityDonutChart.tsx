"use client";

import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface ProbabilityDonutSegment {
  label: string;
  value: number;
  color: string;
}

interface ProbabilityDonutChartProps {
  segments: ProbabilityDonutSegment[];
  className?: string;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Donut chart for 1X2-style probability distributions. Replaces the former
 * chart.js Doughnut wrapper — recharts is already a project dependency and
 * used elsewhere (MatchDashboard, rolling-accuracy-chart), so this avoids
 * shipping two charting libraries for the same visual shape.
 */
export function ProbabilityDonutChart({ segments, className }: ProbabilityDonutChartProps) {
  const data = useMemo(
    () => segments.map((segment) => ({ name: segment.label, value: segment.value, color: segment.color })),
    [segments],
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [formatPercent(value), name]}
            contentStyle={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              borderRadius: 8,
              color: "#cbd5e1",
            }}
          />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ color: "rgba(226, 232, 240, 0.8)", fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProbabilityDonutChart;
