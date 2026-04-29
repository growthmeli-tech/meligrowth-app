"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ParetoDatum = { label: string; value: number };

type Props = {
  data: ParetoDatum[];
  title?: string;
};

export function CatalogParetoChart({ data, title = "Top ~20% SKUs por ganancia × costo (proxy)" }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-[#E8E8E2] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{title}</p>
      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 48, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E2" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [v.toLocaleString("es-AR"), "Peso proxy"]} />
            <Bar dataKey="value" fill="#FFD600" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
