import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { getCompanyById } from "@/lib/data-v2/companies";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";

export default async function OpsFilesPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="cuenta" />;
  }

  const companyResult = await getCompanyById(accountResult.data.company_id);
  const companyName = companyResult.success ? companyResult.data?.name ?? "tu empresa" : "tu empresa";

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-xl font-black text-[#1A1A1A]">Archivos y planillas</h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">
          La carga de planillas (stock, márgenes, ficha técnica, pricing comercial) la coordina el equipo MeliGrowth
          para {companyName}.
        </p>
      </header>

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-5 text-sm leading-relaxed text-[#1A1A1A]">
        <p>
          Subí los archivos template (.xlsx / .csv) en la consola interna de MeliGrowth asociada a esta cuenta. Desde acá
          podés revisar el resultado en <Link href="/ops/pricing">Precios</Link> y{" "}
          <Link href="/ops/catalog" className="font-semibold underline underline-offset-2">
            Catálogo
          </Link>{" "}
          cuando la ingesta esté procesada.
        </p>
        <p className="mt-3 text-[#6B6B6B]">
          Si necesitás permisos de carga o una cuenta interna, pedilo a tu referente MeliGrowth.
        </p>
      </section>
    </main>
  );
}
