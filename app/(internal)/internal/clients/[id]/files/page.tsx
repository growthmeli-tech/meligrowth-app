import Link from "next/link";
import { FileText, UploadCloud } from "lucide-react";
import { uploadCompanyFolderFile } from "@/app/(internal)/internal/clients/[id]/files/actions";
import { FileUploader } from "@/components/files/file-uploader";
import { TemplateCard } from "@/components/files/template-card";
import { createClientFileSignedUrl, listCompanyClientFiles } from "@/lib/data-v2/company-storage-files";
import { getCompanyById } from "@/lib/data-v2/companies";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";

const errorMessages: Record<string, string> = {
  missing_upload: "Seleccioná un archivo antes de subir.",
  size: "El archivo supera el máximo de 10 MB.",
  format: "Formato no soportado. Usá CSV, XLSX u ODS.",
  company: "No encontramos la empresa.",
  storage: "No se pudo subir el archivo a Storage.",
  forbidden: "No tenés permiso para subir archivos."
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
            Planillas y cargas en Storage para la empresa. Cuenta ML: {primaryAccount?.account_name ?? primaryAccount?.seller_id ?? "pendiente"}
          </p>
        </div>
      </header>

      {resolvedSearchParams.uploaded ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          Archivo subido correctamente.
        </div>
      ) : null}
      {resolvedSearchParams.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {errorMessages[resolvedSearchParams.error] ?? "No se pudo completar la operación."}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        {templates.map((template) => (
          <TemplateCard key={template.title} {...template} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <FileUploader action={uploadCompanyFolderFile.bind(null, id)} />
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Carga interna</h2>
          <div className="mt-4 space-y-3 text-sm text-[#6B6B6B]">
            <p>Los archivos se guardan en el bucket <span className="font-mono text-xs">client-files</span> bajo la carpeta de esta company.</p>
            <p>Formatos: CSV, XLSX u ODS. Máximo 10 MB.</p>
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
