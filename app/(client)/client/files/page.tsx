import { uploadClientFile } from "@/app/(client)/client/files/actions";
import { FileStatusBadge } from "@/components/files/file-status-badge";
import { FileUploader } from "@/components/files/file-uploader";
import { TemplateCard } from "@/components/files/template-card";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { getClientFilesBundle } from "@/lib/data";

const errorMessages: Record<string, string> = {
  missing: "Seleccioná un archivo antes de subir.",
  size: "El archivo supera el máximo de 10 MB.",
  format: "Formato no soportado. Usá CSV, XLSX u ODS.",
  client: "No encontramos una cuenta cliente vinculada a tu usuario.",
  storage: "No se pudo subir el archivo a Storage.",
  record: "El archivo subió, pero no se pudo registrar en el historial."
};

const templates = [
  {
    title: "Planilla 1: SKUs y Stock",
    description: "Usala para informar disponibilidad actual por producto.",
    columns: ["sku", "stock"],
    href: "/templates/skus-stock.csv"
  },
  {
    title: "Planilla 2: Márgenes y Costos",
    description: "Permite validar rentabilidad antes de tomar decisiones de publicidad.",
    columns: ["sku", "costo", "precio", "margen"],
    href: "/templates/margenes-costos.csv"
  },
  {
    title: "Planilla 3: Ficha Técnica",
    description: "Ayuda a detectar oportunidades de mejora en publicaciones.",
    columns: ["sku", "titulo", "descripcion", "atributos"],
    href: "/templates/ficha-tecnica.csv"
  },
  {
    title: "Planilla 4: Pricing Comercial",
    description: "Completala y compartila con tu operador para armar la propuesta económica.",
    columns: ["plan", "current_revenue", "projected_revenue", "gross_margin_pct", "delivery_cost", "setup_fee", "months"],
    href: "/templates/pricing-calculadora.xlsx"
  }
];

export default async function ClientFilesPage({ searchParams }: { searchParams?: Promise<{ error?: string; uploaded?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { files } = await getClientFilesBundle();
  return (
    <AppShell mode="client">
      <div className="space-y-6">
        <div>
          <div className="text-sm font-semibold text-brand-dark">Tu cuenta</div>
          <h1 className="text-3xl font-bold">Subir archivos</h1>
          <p className="mt-2 text-zinc-600">Usá las plantillas de SKUs, márgenes y ficha técnica para mantener el diagnóstico actualizado.</p>
        </div>
        {resolvedSearchParams.uploaded ? (
          <div className="rounded-card border border-[#639922]/30 bg-[#EAF3DE] p-4 text-sm font-semibold text-[#27500A]">
            {resolvedSearchParams.uploaded === "processed"
              ? "Archivo subido y procesado correctamente."
              : resolvedSearchParams.uploaded === "processing_error"
                ? "Archivo subido. No se pudo procesar automáticamente; el equipo revisará el error."
                : "Archivo subido. Quedó pendiente de procesamiento."}
          </div>
        ) : null}
        {resolvedSearchParams.error ? (
          <div className="rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]">
            {errorMessages[resolvedSearchParams.error] ?? "No se pudo subir el archivo."}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard key={template.title} {...template} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <FileUploader action={uploadClientFile} />
          <Card>
            <h2 className="text-lg font-bold">Antes de subir</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>El archivo debe estar en formato CSV, XLSX u ODS.</p>
              <p>La primera fila tiene que contener los nombres de columnas.</p>
              <p>El sistema detecta automáticamente si es stock, márgenes o ficha técnica.</p>
              <p>Tamaño máximo: 10 MB.</p>
            </div>
          </Card>
        </section>

        <Card>
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
            <div>
              <h2 className="text-lg font-bold">Historial</h2>
              <p className="mt-1 text-sm text-zinc-500">Últimos archivos recibidos y estado de procesamiento.</p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-black/10">
            {files.map((file) => (
              <div key={file.id} className="flex flex-col justify-between gap-3 py-3 md:flex-row md:items-center">
                <div>
                  <div className="font-semibold">{file.filename}</div>
                  <div className="text-sm text-zinc-500">
                    {file.tipo.replace("_", " ")} · {new Date(file.createdAt).toLocaleDateString("es-AR")}
                  </div>
                </div>
                <FileStatusBadge processed={file.procesado} error={file.errorProcesamiento} />
              </div>
            ))}
            {files.length === 0 ? <div className="py-6 text-sm text-zinc-500">Todavía no subiste archivos.</div> : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
