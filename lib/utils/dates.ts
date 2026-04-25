export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

export function formatRelative(date: string | Date): string {
  const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), "seconds");
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), "minutes");
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), "hours");
  return rtf.format(Math.round(diff / 86400), "days");
}
