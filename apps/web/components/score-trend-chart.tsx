"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

interface TrendPoint {
  date: string;
  [scoreName: string]: string | number;
}

interface Props {
  data: TrendPoint[];
  scoreNames: string[];
}

const COLORS = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#fb7185",
  "#22d3ee",
  "#facc15",
];

export default function ScoreTrendChart({ data, scoreNames }: Props) {
  if (data.length === 0 || scoreNames.length === 0) {
    return (
      <div className="border border-gray-800 rounded-lg p-6 bg-gray-900/40 text-sm text-gray-500">
        No score history yet. Call <code className="text-gray-300">sentro.score()</code> to start tracking quality over time.
      </div>
    );
  }

  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/40">
      <div className="text-sm font-medium text-gray-300 mb-4">Score trend (7 days)</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
          <YAxis stroke="#6b7280" fontSize={11} domain={[0, "auto"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "#d1d5db" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {scoreNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
