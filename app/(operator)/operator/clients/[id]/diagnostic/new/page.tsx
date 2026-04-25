import { createDiagnostic } from "@/app/(operator)/operator/clients/[id]/diagnostic/new/actions";
import { DiagnosticForm } from "@/components/diagnostic/diagnostic-form";
import { AppShell } from "@/components/layout/app-shell";
import { getOperatorDiagnosticFormBundle } from "@/lib/data";

export default async function NewDiagnosticPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { client, diagnostic } = await getOperatorDiagnosticFormBundle(resolvedParams.id);
  const saveAction = createDiagnostic.bind(null, client.id);

  return (
    <AppShell mode="operator">
      <div className="space-y-6">
        <div>
          <div className="text-sm font-semibold text-brand-dark">{client.name}</div>
          <h1 className="text-3xl font-bold">Nuevo diagnóstico</h1>
          <p className="mt-2 text-zinc-600">El guardado calcula scores en servidor, crea historial y genera acciones recomendadas.</p>
        </div>
        {resolvedSearchParams.error ? (
          <div className="rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]">
            {resolvedSearchParams.error === "actions"
              ? "El diagnóstico se guardó, pero no se pudieron crear las acciones automáticas. Revisá permisos de actions."
              : "No se pudo guardar el diagnóstico. Revisá permisos RLS y que el cliente pertenezca al operador."}
          </div>
        ) : null}
        <DiagnosticForm diagnostic={diagnostic} action={saveAction} />
      </div>
    </AppShell>
  );
}
