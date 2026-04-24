"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ScoreHistoryChart({
  data
}: {
  data: Array<{ date: string; scoreGlobal: number }>;
}) {
  if (data.length === 0) {
    return <div className="flex h-72 w-full items-center justify-center rounded-component border border-dashed border-black/15 text-sm text-zinc-500">Sin datos para este período</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#ECECF1" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#71717A" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#71717A" />
          <Tooltip />
          <Line type="monotone" dataKey="scoreGlobal" stroke="#534AB7" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
