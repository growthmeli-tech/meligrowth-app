"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type PriorityItem = {
  id: string;
  title: string;
  subtitle: string;
  priority: "urgente" | "alta" | "media" | "baja";
  href?: string;
};

export type PriorityListProps = {
  items: PriorityItem[];
  activeId?: string | null;
  onSelect?: (item: PriorityItem) => void;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
};

const EMOJI_PRIORITY: Record<PriorityItem["priority"], string> = {
  urgente: "🔴",
  alta: "🟠",
  media: "🟡",
  baja: "🔵"
};

export function PriorityList({ items, activeId = null, onSelect, loading = false, error = null, empty = false }: PriorityListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-14 rounded bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p className="text-sm text-red-600">No pudimos cargar prioridades</p>
        <button type="button" className="mt-2 bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
          Reintentar
        </button>
      </div>
    );
  }

  if (empty || items.length === 0) {
    return (
      <div>
        <p className="text-sm text-[#6B6B6B]">No hay prioridades urgentes hoy</p>
        <button type="button" className="mt-2 bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
          Ver backlog de tareas
        </button>
      </div>
    );
  }

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">HOY HACES ESTO</p>
      <div className="mt-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={cn("group w-full py-3 border-b border-[#E8E8E2] text-left hover:bg-gray-50 transition-colors duration-150", activeId === item.id && "bg-yellow-50")}
          >
            <div className="flex items-start justify-between gap-2 px-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A1A1A] line-clamp-2">
                  <span className="mr-2 text-2xl font-black font-mono tabular-nums">{index + 1}</span>
                  <span className="mr-1">{EMOJI_PRIORITY[item.priority]}</span>
                  {item.title}
                </p>
                <p className="text-xs text-[#6B6B6B] line-clamp-2">{item.subtitle}</p>
              </div>
              <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">→</span>
            </div>
            {item.href ? (
              <Link href={item.href} className="mt-2 inline-flex items-center text-xs font-semibold text-[#1A1A1A] underline underline-offset-2">
                Ver detalle →
              </Link>
            ) : (
              <button type="button" onClick={() => onSelect?.(item)} className="mt-2 text-xs font-semibold text-[#1A1A1A] underline underline-offset-2">
                Ver detalle →
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
