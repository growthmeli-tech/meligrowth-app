import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(value: number) {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export function formatMoney(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  });
}

export function daysSince(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  return Math.floor(diff / 86_400_000);
}
