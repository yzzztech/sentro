"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Bucket {
  t: string;
  count: number;
}

export default function OverviewRunsChart({ data }: { data: Bucket[] }) {
  const chartData = data.map((b) => ({
    label: new Date(b.t).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
    }),
    count: b.count,
  }));
  const total = data.reduce((s, b) => s + b.count, 0);

  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/40">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm font-medium text-gray-200">Runs per hour · 7 days</div>
        <div className="text-xs text-gray-500">{total.toLocaleString()} total</div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="runsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke="#6b7280"
            fontSize={10}
            interval={Math.max(0, Math.floor(chartData.length / 8))}
          />
          <YAxis stroke="#6b7280" fontSize={10} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "#d1d5db" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#60a5fa"
            strokeWidth={2}
            fill="url(#runsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
