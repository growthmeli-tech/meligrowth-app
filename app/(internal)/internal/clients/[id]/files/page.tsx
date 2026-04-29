import Link from "next/link";
import { FileText, UploadCloud } from "lucide-react";
import { FileIngestionPanel } from "@/components/files/file-ingestion-panel";
import { TemplateCard } from "@/components/files/template-card";
import { uploadCompanyFolderFile } from "@/app/(internal)/internal/clients/[id]/files/actions";
import { FileUploader } from "@/components/files/file-uploader";
import { createClientFileSignedUrl, listCompanyClientFiles } from "@/lib/data-v2/company-storage-files";
import { getCompanyById } from "@/lib/data-v2/companies";
import { listIngestionLogsByAccount, getLastSuccessIngestionByTemplate } from "@/lib/data-v2/file-ingestion-log";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import type { TemplateType } from "@/lib/ingestion/types";

const errorMessages: Record<string, string> = {
  missing_upload: "Seleccioná un archivo antes de subir.",
  size: "El archivo supera el máximo de 10 MB.",
  format: "Formato no soportado. Usá CSV, XLSX u ODS.",
  company: "No encontramos la empresa.",
  storage: "No se pudo subir el archivo a Storage.",
  forbidden: "No tenés permiso para subir archivos."
};

const templateDefs = [
  {
    key: "skus_stock" as const,
    title: "Planilla 1: SKUs y Stock",
    description: "Modelo base para que el cliente informe disponibilidad por SKU.",
    columns: ["sku", "producto", "stock", "dias_stock"],
    href: "/templates/skus-stock.csv"
  },
  {
    key: "margenes_costos" as const,
    title: "Planilla 2: Márgenes y Costos",
    description: "Necesaria para validar rentabilidad y decisiones de Ads.",
    columns: ["sku", "producto", "costo", "peso_kg", "logistica", "reputacion", "publicidad_pct", "margen_pct", "notas"],
    href: "/templates/margenes-costos.csv"
  },
  {
    key: "ficha_tecnica" as const,
    title: "Planilla 3: Ficha Técnica",
    description: "Sirve para enriquecer títulos, descripciones y atributos.",
    columns: ["sku", "titulo", "descripcion", "atributos"],
    href: "/templates/ficha-tecnica.csv"
  },
  {
    key: "pricing_comercial" as const,
    title: "Planilla 4: Pricing Comercial",
    description: "Escenarios comerciales (ingresos, márgenes, costo operativo).",
    columns: ["plan", "current_revenue", "projected_revenue", "gross_margin_pct", "delivery_cost", "setup_fee", "months"],
    href: "/templates/pricing-calculadora.xlsx"
  }
];

function quickStatsForTemplate(
  t: TemplateType,
  metrics: unknown
): string | null {
  if (!metrics || typeof metrics !== "object") return null;
  const o = metrics as Record<string, unknown>;
  if (t === "skus_stock") {
    if (o.skus_sin_stock_pct == null) return null;
    const d = o.dias_stock;
    return `SKUs sin stock ${Number(o.skus_sin_stock_pct).toFixed(1)}%${typeof d === "number" ? ` · días stock promedio ${d.toFixed(0)}` : ""}`;
  }
  if (t === "margenes_costos") {
    if (o.margen_pre_ads_pct == null && o.skus == null) return null;
    if (typeof o.margen_pre_ads_pct === "number") {
      return `Margen pre-ads ponderado ${o.margen_pre_ads_pct.toFixed(1)}%${typeof o.skus === "number" ? ` · ${o.skus} SKUs` : ""}`;
    }
    if (typeof o.skus === "number") return `${o.skus} SKUs importados`;
  }
  if (t === "ficha_tecnica") {
    if (o.filas == null) return null;
    return `${o.filas} publicaciones en catálogo local`;
  }
  if (t === "pricing_comercial") {
    if (o.mejor_plan) return `Mejor escenario: ${o.mejor_plan}${o.net_margin != null ? ` (neto ${(Number(o.net_margin) * 100).toFixed(1)}%)` : ""}`;
  }
  return null;
}

export default async function InternalClientFilesPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; uploaded?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const companyResult = await getCompanyById(id);
  if (!companyResult.success || !companyResult.data) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar esta cuenta</div>
      </main>
    );
  }

  const accountsResult = await listMlAccountsByCompany(id, { activeOnly: true });
  const primaryAccount = accountsResult.success ? (accountsResult.data[0] ?? null) : null;
  const mlId = primaryAccount?.id ?? "";

  const lastBy = async (k: (typeof templateDefs)[number]["key"]) => {
    if (!mlId) return null;
    const r = await getLastSuccessIngestionByTemplate(mlId, k);
    return r.success ? r.data : null;
  };
  const [a, b, c, d] = await Promise.all([lastBy("skus_stock"), lastBy("margenes_costos"), lastBy("ficha_tecnica"), lastBy("pricing_comercial")]);
  const lastMap: Record<string, typeof a> = {
    skus_stock: a,
    margenes_costos: b,
    ficha_tecnica: c,
    pricing_comercial: d
  };

  const logsRes = mlId ? await listIngestionLogsByAccount(mlId, 50) : { success: true as const, data: [] };
  const historyRows =
    logsRes.success && Array.isArray(logsRes.data)
      ? logsRes.data.map((r) => ({
          id: r.id,
          filename: r.filename,
          template_type: r.template_type,
          rows_valid: r.rows_valid,
          rows_error: r.rows_error,
          status: r.status,
          processed_at: r.processed_at,
          metrics_updated: r.metrics_updated,
          alerts_generated: r.alerts_generated
        }))
      : [];

  const filesResult = await listCompanyClientFiles(id);
  const rawFiles = filesResult.success ? filesResult.data : [];

  const filesWithUrls = await Promise.all(
    rawFiles.map(async (f) => {
      const signed = await createClientFileSignedUrl(f.path);
      return {
        ...f,
        downloadUrl: signed.success ? signed.data : null
      };
    })
  );

  return (
    <main className="p-4 md:p-6 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/internal/clients/${id}`} className="text-xs font-semibold text-[#6B6B6B] hover:underline">
            ← {companyResult.data.name}
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[#1A1A1A]">Archivos</h1>
          <p className="text-sm text-[#6B6B6B]">
            Planillas e ingesta operativa. Cuenta ML: {primaryAccount?.account_name ?? primaryAccount?.seller_id ?? "pendiente"}
          </p>
        </div>
      </header>

      {resolvedSearchParams.uploaded ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Archivo subido correctamente (Storage).
        </div>
      ) : null}
      {resolvedSearchParams.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessages[resolvedSearchParams.error] ?? "No se pudo completar la operación."}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        {templateDefs.map((template) => {
          const last = lastMap[template.key];
          const m = last?.metrics_updated;
          return (
            <TemplateCard
              key={template.title}
              title={template.title}
              description={template.description}
              columns={template.columns}
              href={template.href}
              lastImportAt={last?.processed_at}
              lastRowsValid={last?.rows_valid}
              quickStats={quickStatsForTemplate(template.key, m)}
              statusMode={last?.processed_at ? "ok" : "empty"}
            />
          );
        })}
      </section>

      {mlId ? (
        <FileIngestionPanel companyId={id} mlAccountId={mlId} ingestionHistory={historyRows} />
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Aún no hay una cuenta ML asociada. Creá o vinculá una cuenta para importar planillas.
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <FileUploader action={uploadCompanyFolderFile.bind(null, id)} />
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Carga a Storage (sin pipeline)</h2>
          <div className="mt-4 space-y-3 text-sm text-[#6B6B6B]">
            <p>Sube archivos al bucket <span className="font-mono text-xs">client-files</span> bajo la carpeta de esta company, sin validación ni actualización de métricas.</p>
            <p>Para actualizar snapshot, alertas y tablas, usá el uploader con preview arriba.</p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
            <UploadCloud className="h-4 w-4" />
            Supabase Storage
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <h2 className="text-lg font-bold text-[#1A1A1A]">Archivos en la cuenta</h2>
        {filesResult.success === false ? (
          <p className="mt-3 text-sm text-red-700">{filesResult.error}</p>
        ) : filesWithUrls.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B6B6B]">Todavía no hay archivos para esta empresa.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#E8E8E2]">
            {filesWithUrls.map((file) => (
              <li key={file.path} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-5 w-5 text-[#6B6B6B]" />
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">{file.name}</p>
                    <p className="text-xs text-[#6B6B6B]">
                      {file.sizeBytes != null ? `${(file.sizeBytes / 1024).toFixed(0)} KB` : "Tamaño N/D"}
                      {file.updatedAt ? ` · ${new Date(file.updatedAt).toLocaleString("es-AR")}` : ""}
                    </p>
                  </div>
                </div>
                {file.downloadUrl ? (
                  <a
                    href={file.downloadUrl}
                    className="inline-flex rounded-lg border border-[#E8E8E2] px-4 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#F5F5F0]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Descargar
                  </a>
                ) : (
                  <span className="text-xs text-amber-700">No se pudo generar enlace</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
