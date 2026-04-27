import { RefreshCw, UploadCloud } from "lucide-react";
import { reprocessClientFile, uploadOperatorClientFile } from "@/app/(operator)/operator/clients/[id]/files/actions";
import { FileUploader } from "@/components/files/file-uploader";
import { FileStatusBadge } from "@/components/files/file-status-badge";
import { TemplateCard } from "@/components/files/template-card";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOperatorClientBundle, getParsedDataPreview } from "@/lib/data";

const errorMessages: Record<string, string> = {
  missing: "No encontramos ese archivo para este cliente.",
  config: "Falta configurar SUPABASE_SERVICE_ROLE_KEY, PARSER_SERVICE_URL o PARSER_SERVICE_SECRET.",
  missing_upload: "Seleccioná un archivo antes de subir.",
  size: "El archivo supera el máximo de 10 MB.",
  format: "Formato no soportado. Usá CSV, XLSX u ODS.",
  client: "No encontramos el cliente para registrar el archivo.",
  storage: "No se pudo subir el archivo a Storage.",
  record: "El archivo subió, pero no se pudo registrar en el historial."
};

const templates = [
  {
    title: "Planilla 1: SKUs y Stock",
    description: "Modelo base para que el cliente informe disponibilidad por SKU.",
    columns: ["sku", "stock"],
    href: "/templates/skus-stock.csv"
  },
  {
    title: "Planilla 2: Márgenes y Costos",
    description: "Necesaria para validar rentabilidad y decisiones de Ads.",
    columns: ["sku", "costo", "precio", "margen"],
    href: "/templates/margenes-costos.csv"
  },
  {
    title: "Planilla 3: Ficha Técnica",
    description: "Sirve para enriquecer títulos, descripciones y atributos.",
    columns: ["sku", "titulo", "descripcion", "atributos"],
    href: "/templates/ficha-tecnica.csv"
  },
  {
    title: "Planilla 4: Pricing Comercial",
    description: "Permite importar el escenario comercial directamente en la calculadora.",
    columns: ["plan", "current_revenue", "projected_revenue", "gross_margin_pct", "delivery_cost", "setup_fee", "months"],
    href: "/templates/pricing-calculadora.xlsx"
  }
];

export default async function OperatorFilesPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; processed?: string; uploaded?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { client, files } = await getOperatorClientBundle(resolvedParams.id);
  const preview = await getParsedDataPreview(client.id);
  return (
    <AppShell mode="operator">
      <div className="space-y-6">
        <div>
          <div className="text-sm font-semibold text-brand-dark">{client.name}</div>
          <h1 className="text-3xl font-bold">Archivos del cliente</h1>
        </div>
        {resolvedSearchParams.processed ? (
          <div className={`rounded-card border p-4 text-sm font-semibold ${resolvedSearchParams.processed === "1" ? "border-[#639922]/30 bg-[#EAF3DE] text-[#27500A]" : "border-[#E24B4A]/30 bg-[#FCEBEB] text-[#791F1F]"}`}>
            {resolvedSearchParams.processed === "1" ? "Archivo reprocesado correctamente." : "No se pudo procesar el archivo. Revisá el detalle de error."}
          </div>
        ) : null}
        {resolvedSearchParams.uploaded ? (
          <div className="rounded-card border border-[#639922]/30 bg-[#EAF3DE] p-4 text-sm font-semibold text-[#27500A]">
            {resolvedSearchParams.uploaded === "processed"
              ? "Archivo subido y procesado correctamente."
              : resolvedSearchParams.uploaded === "processing_error"
                ? "Archivo subido. No se pudo procesar automáticamente; revisá el detalle."
                : "Archivo subido. Quedó pendiente de procesamiento."}
          </div>
        ) : null}
        {resolvedSearchParams.error ? (
          <div className="rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]">
            {errorMessages[resolvedSearchParams.error] ?? "No se pudo reprocesar el archivo."}
          </div>
        ) : null}
        <section className="grid gap-4 xl:grid-cols-4">
          {templates.map((template) => (
            <TemplateCard key={template.title} {...template} />
          ))}
        </section>
        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <FileUploader action={uploadOperatorClientFile.bind(null, client.id)} />
          <Card>
            <h2 className="text-lg font-bold">Carga asistida por operador</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>Podés subir plantillas en nombre del cliente desde esta vista.</p>
              <p>Si el parser está configurado, el archivo se procesa automáticamente y actualiza las vistas de operador y cliente.</p>
              <p>La planilla de pricing también se puede reutilizar después desde la calculadora comercial.</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-dark">
              <UploadCloud className="h-4 w-4" />
              Flujo unificado con Storage y Supabase
            </div>
          </Card>
        </section>
        <Card>
          <div className="divide-y divide-black/10">
            {files.map((file) => (
              <div key={file.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">{file.filename}</div>
                  <div className="text-sm text-zinc-500">{file.tipo} · {(file.sizeBytes / 1024).toFixed(0)} KB</div>
                  {file.errorProcesamiento ? <div className="mt-1 text-sm text-[#791F1F]">{file.errorProcesamiento}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <FileStatusBadge processed={file.procesado} error={file.errorProcesamiento} />
                  <form action={reprocessClientFile.bind(null, client.id, file.id)}>
                    <Button variant="secondary" type="submit">
                        <RefreshCw className="h-4 w-4" />
                        Reprocesar
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Vista previa extraída</h2>
          <div className="mt-4 grid gap-5 xl:grid-cols-3">
            <PreviewTable
              title="SKUs y stock"
              headers={["SKU", "Stock", "Título"]}
              rows={preview.products.map((row) => [row.sku, row.stock ?? "-", row.title ?? "-"])}
            />
            <PreviewTable
              title="Márgenes"
              headers={["SKU", "Costo", "Precio", "Margen"]}
              rows={preview.margins.map((row) => [row.sku, row.costo ?? "-", row.precio ?? "-", row.margen ?? "-"])}
            />
            <PreviewTable
              title="Fichas"
              headers={["SKU", "Título", "Descripción"]}
              rows={preview.specs.map((row) => [row.sku, row.titulo ?? "-", row.descripcion ?? "-"])}
            />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function PreviewTable({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div>
      <h3 className="font-semibold text-zinc-950">{title}</h3>
      <div className="mt-3 overflow-x-auto rounded-card border border-black/10">
        {rows.length > 0 ? (
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-black/10 text-zinc-500">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-3 py-2">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row[0])} className="border-b border-black/5">
                    {row.map((cell, index) => (
                      <td key={`${row[0]}-${index}`} className={`px-3 py-3 ${index === 0 ? "font-medium" : ""}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
        ) : (
          <div className="p-4 text-sm text-zinc-500">Sin datos procesados.</div>
        )}
      </div>
    </div>
  );
}
