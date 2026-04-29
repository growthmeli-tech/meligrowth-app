import Link from "next/link";

export default function BrandFilesPage() {
  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">Planillas</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Coordiná con tu operador MeliGrowth la carga de archivos template para tu cuenta.
        </p>
      </header>
      <section className="rounded-xl border border-[#E8E8E2] bg-white p-5 text-sm leading-relaxed text-[#1A1A1A]">
        <p>
          Las planillas se procesan desde la consola interna del equipo. Vas a ver reflejos en{" "}
          <Link href="/brand/profitability" className="font-semibold underline underline-offset-2">
            Rentabilidad
          </Link>{" "}
          cuando los datos estén disponibles.
        </p>
      </section>
    </main>
  );
}
