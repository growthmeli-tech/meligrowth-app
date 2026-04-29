import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";

export function TemplateCard({
  title,
  description,
  columns,
  href,
  lastImportAt = null,
  lastRowsValid = null,
  quickStats = null,
  statusMode = "empty"
}: {
  title: string;
  description: string;
  columns: string[];
  href: string;
  lastImportAt?: string | null;
  lastRowsValid?: number | null;
  quickStats?: string | null;
  statusMode?: "empty" | "ok";
}) {
  const when = lastImportAt ? new Date(lastImportAt).toLocaleString("es-AR") : null;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-component bg-brand-light text-brand-purple">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-zinc-950">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {statusMode === "ok" && when ? (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-900">Datos del {when.split(" ")[0]}</span>
        ) : (
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600">Sin datos</span>
        )}
        {lastRowsValid != null && <span className="text-zinc-500">{lastRowsValid} filas (última importación)</span>}
        {quickStats && <span className="text-zinc-700">{quickStats}</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {columns.map((column) => (
          <span key={column} className="rounded-component bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
            {column}
          </span>
        ))}
      </div>
      <Link href={href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-dark" download>
        <Download className="h-4 w-4" />
        Descargar {title.replace(/^Planilla \d+:\s*/, "")}
      </Link>
    </Card>
  );
}
