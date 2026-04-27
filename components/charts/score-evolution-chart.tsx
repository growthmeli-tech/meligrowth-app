"use client";

import { ResponsiveContainer, Area, AreaChart, CartesianGrid, Line, Tooltip, XAxis, YAxis } from "recharts";
import { DESIGN_TOKENS, type ScoreStatusKey } from "@/lib/config/design-tokens";
import { getScoreStatus } from "@/lib/utils/scores";

export type ScoreEvolutionChartProps = {
  data: Array<{ date: string; score_global: number; score_salud?: number; score_ads?: number }>;
  showBlocks?: boolean;
  height?: number;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
};

export function ScoreEvolutionChart({
  data,
  showBlocks = false,
  height = 200,
  loading = false,
  error = null,
  empty = false
}: ScoreEvolutionChartProps) {
  if (loading) return <div className="h-[200px] rounded-xl bg-gray-200 animate-pulse" />;

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">No pudimos cargar la evolucion</p>
        <button type="button" className="mt-2 bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
          Reintentar
        </button>
      </div>
    );
  }

  if (empty || data.length === 0) {
    return (
      <div>
        <p className="text-sm text-[#6B6B6B]">Sin historial suficiente para mostrar evolucion</p>
        <button type="button" className="mt-2 bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
          Cargar nuevo diagnostico
        </button>
      </div>
    );
  }

  const status = getScoreStatus(data[data.length - 1]?.score_global ?? 0) as ScoreStatusKey;
  const scoreColor = DESIGN_TOKENS.score[status].color;
  const chartHeight = height < 200 ? 180 : 200;
  const lastIndex = data.length - 1;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={scoreColor} stopOpacity={0.1} />
            <stop offset="100%" stopColor={scoreColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#E8E8E2" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
        <YAxis hide />
        <Tooltip contentStyle={{ backgroundColor: "#FFFFFF", borderRadius: "0.5rem", border: "1px solid #E8E8E2", boxShadow: "0 10px 20px rgba(0,0,0,0.08)", padding: "0.75rem" }} />
        <Area type="monotone" dataKey="score_global" stroke="none" fill="url(#scoreAreaGradient)" animationDuration={250} />
        <Line
          type="monotone"
          dataKey="score_global"
          stroke={scoreColor}
          strokeWidth={2.5}
          dot={(props: { cx?: number; cy?: number; index?: number }) => {
            if (props.cx === undefined || props.cy === undefined) return <></>;
            if (props.index === lastIndex) {
              return <circle cx={props.cx} cy={props.cy} r={6} fill={scoreColor} stroke="white" strokeWidth={2} />;
            }
            return <circle cx={props.cx} cy={props.cy} r={3} fill={scoreColor} opacity={0} />;
          }}
          activeDot={{ r: 7 }}
          animationDuration={500}
        />
        {showBlocks ? <Line type="monotone" dataKey="score_salud" stroke="#60A5FA" strokeWidth={1.5} dot={false} /> : null}
        {showBlocks ? <Line type="monotone" dataKey="score_ads" stroke="#F59E0B" strokeWidth={1.5} dot={false} /> : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}
