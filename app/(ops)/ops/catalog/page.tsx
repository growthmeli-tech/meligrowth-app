import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { listCatalogEnrichment } from "@/lib/data-v2/catalog-enrichment";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import type { Json } from "@/lib/supabase/database.types";

function formatAtributos(v: Json): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 120 ? `${v.slice(0, 117)}…` : v;
  try {
    const s = JSON.stringify(v);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return "—";
  }
}

export default async function OpsCatalogPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="cuenta" />;
  }

  const listResult = await listCatalogEnrichment(accountResult.data.id);
  if (!listResult.success) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        No pudimos cargar el catálogo enriquecido.
      </div>
    );
  }

  const rows = listResult.data;

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-xl font-black text-[#1A1A1A]">Catálogo</h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">Ficha técnica importada por SKU.</p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-6 text-center">
          <p className="text-sm font-medium text-[#1A1A1A]">
            Subí la Planilla 3 (Ficha Técnica) para ver el catálogo.
          </p>
          <Link href="/ops/files" className="mt-4 inline-flex rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A]">
            Ir a Archivos
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E8E8E2] bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#E8E8E2] bg-[#F5F5F0] text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">
                <th className="p-3">SKU</th>
                <th className="p-3">Título</th>
                <th className="p-3">Descripción</th>
                <th className="p-3">Atributos</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hasTitulo = Boolean(r.titulo?.trim());
                const hasDesc = Boolean(r.descripcion?.trim());
                const hasAttr =
                  r.atributos !== null &&
                  r.atributos !== undefined &&
                  (typeof r.atributos === "object"
                    ? Object.keys(r.atributos as object).length > 0
                    : String(r.atributos).trim() !== "");
                const completo = hasTitulo && hasDesc && hasAttr;
                return (
                  <tr key={r.id} className="border-b border-[#E8E8E2] align-top">
                    <td className="p-3 font-mono text-xs">{r.sku}</td>
                    <td className="p-3 max-w-[200px] text-[#1A1A1A]">{r.titulo}</td>
                    <td className="p-3 max-w-[220px] text-xs text-[#6B6B6B]">
                      {r.descripcion ? (r.descripcion.length > 160 ? `${r.descripcion.slice(0, 157)}…` : r.descripcion) : "—"}
                    </td>
                    <td className="p-3 max-w-[200px] font-mono text-xs text-[#6B6B6B]">{formatAtributos(r.atributos)}</td>
                    <td className="p-3">
                      <span
                        className={
                          completo
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900"
                            : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                        }
                      >
                        {completo ? "Completo" : "Incompleto"}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs text-[#6B6B6B]">
                      {r.updated_at ? new Date(r.updated_at).toLocaleString("es-AR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
