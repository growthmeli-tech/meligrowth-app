"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BlockComparisonChart({
  data
}: {
  data: Array<{ name: string; anterior: number; actual: number }>;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#ECECF1" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#71717A" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#71717A" />
          <Tooltip />
          <Bar dataKey="anterior" fill="#D9D6FA" radius={[6, 6, 0, 0]} />
          <Bar dataKey="actual" fill="#534AB7" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
