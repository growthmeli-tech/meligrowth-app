import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { runDailyScraping } from "@/app/(operator)/operator/settings/actions";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getRecentScrapingJobs } from "@/lib/data";
import { getRuntimeChecks, getRuntimeReadiness } from "@/lib/supabase/config";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{
    daily_ok?: string;
    daily_error?: string;
    daily_created?: string;
    daily_dispatched?: string;
    daily_skipped_clients?: string;
    daily_skipped_jobs?: string;
    daily_consolidated?: string;
    daily_consolidation_skipped?: string;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const scrapingJobs = await getRecentScrapingJobs();
  const runtimeChecks = getRuntimeChecks();
  const readiness = getRuntimeReadiness();
  const groups = ["Core", "Automatización", "Email"] as const;

  return (
    <AppShell mode="operator">
      <div className="space-y-6">
        <div>
          <div className="text-sm font-semibold text-brand-dark">Operación técnica</div>
          <h1 className="mt-1 text-3xl font-bold text-zinc-950">Configuración general</h1>
          <p className="mt-2 max-w-3xl text-zinc-600">Supabase, Resend, cron, parser y scraper se configuran por variables de entorno. Esta vista muestra presencia de variables, nunca sus valores.</p>
        </div>

        {resolvedSearchParams.daily_ok ? (
          <div className="rounded-card border border-[#639922]/30 bg-[#EAF3DE] p-4 text-sm font-semibold text-[#27500A]">
            Dispatch diario ejecutado. Jobs creados: {resolvedSearchParams.daily_created ?? "0"} · enviados al scraper: {resolvedSearchParams.daily_dispatched ?? "0"} · diagnósticos consolidados: {resolvedSearchParams.daily_consolidated ?? "0"} · consolidación pendiente o incompleta: {resolvedSearchParams.daily_consolidation_skipped ?? "0"} · clientes salteados: {resolvedSearchParams.daily_skipped_clients ?? "0"} · jobs ya existentes hoy: {resolvedSearchParams.daily_skipped_jobs ?? "0"}
          </div>
        ) : null}
        {resolvedSearchParams.daily_error ? (
          <div className="rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]">
            {resolvedSearchParams.daily_error === "scraper"
              ? "Falta configurar el pipeline del scraper antes de correr el dispatch diario."
              : resolvedSearchParams.daily_error === "supabase"
                ? "Falta la configuración service role de Supabase para correr el dispatch diario."
                : "No pudimos ejecutar el dispatch diario. Revisá logs y scraping jobs recientes."}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <ReadinessCard label="Variables configuradas" value={`${readiness.configured}/${readiness.total}`} ok={readiness.configured === readiness.total} />
          <ReadinessCard label="Core Supabase" value={readiness.coreReady ? "Listo" : "Pendiente"} ok={readiness.coreReady} />
          <ReadinessCard label="Parser" value={readiness.parserReady ? "Listo" : "Pendiente"} ok={readiness.parserReady} />
          <ReadinessCard label="Scraper" value={readiness.scraperReady ? "Listo" : "Pendiente"} ok={readiness.scraperReady} />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {groups.map((group) => {
            const checks = runtimeChecks.filter((check) => check.group === group);
            return (
              <Card key={group}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-zinc-950">{group}</h2>
                  <Badge className="bg-zinc-100 text-zinc-700">
                    {checks.filter((check) => check.configured).length}/{checks.length}
                  </Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {checks.map((check) => (
                    <div key={check.key} className="rounded-component border border-black/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-zinc-950">{check.label}</div>
                          <div className="mt-1 text-xs text-zinc-500">{check.requiredFor}</div>
                          {check.valueHint ? <div className="mt-2 text-xs font-semibold text-zinc-700">Valor actual: {check.valueHint}</div> : null}
                        </div>
                        <Badge className={check.configured ? "bg-[#EAF3DE] text-[#27500A]" : "bg-[#FAEEDA] text-[#633806]"}>
                          {check.configured ? "OK" : "Falta"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <Card>
            <h2 className="text-lg font-bold text-zinc-950">Conexión Mercado Libre</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>Para pasar del mock al scraping real necesitamos tres cosas por cuenta: `Seller ID`, `URL de cuenta ML` y una `sesión Playwright guardada`.</p>
              <p>La sesión se guarda por seller en `services/scraper/sessions/&lt;SELLER_ID&gt;.json` o en el bucket privado `meli-sessions`.</p>
              <p>El scraper ya tiene rutas preparadas para `salud`, `publicaciones`, `ads` y `stock`. Hoy, si `SCRAPER_MOCK_MODE=true`, devuelve fixtures controlados.</p>
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-bold text-zinc-950">Checklist scraper real</h2>
            <div className="mt-4 space-y-3">
              {[
                "Configurar SCRAPER_SERVICE_URL y SCRAPER_SERVICE_SECRET",
                "Desactivar SCRAPER_MOCK_MODE en producción",
                "Guardar storage state por vendedor",
                "Verificar seller ID y perfil ML en cada cliente"
              ].map((item) => (
                <div key={item} className="rounded-component border border-black/10 p-3 text-sm text-zinc-700">{item}</div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">Dispatch diario de scraping</h2>
              <p className="mt-2 max-w-3xl text-sm text-zinc-600">
                Este disparador crea jobs para clientes activos con sesión ML disponible, evita duplicados del mismo día, los envía al scraper y luego intenta consolidar el diagnóstico del día si ya están los bloques necesarios.
              </p>
            </div>
            <div className="rounded-component border border-black/10 px-3 py-2 text-sm text-zinc-600">
              Listo para correr: <strong>{readiness.scraperReady ? "Sí" : "No"}</strong>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <form action={runDailyScraping}>
              <input type="hidden" name="dispatch" value="1" />
              <Button type="submit" disabled={!readiness.scraperReady}>Crear y despachar jobs</Button>
            </form>
            <form action={runDailyScraping}>
              <input type="hidden" name="dispatch" value="0" />
              <Button type="submit" variant="secondary" disabled={!readiness.coreReady}>Solo crear cola del día</Button>
            </form>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-zinc-950">Smoke test en deploy</h2>
          <div className="mt-4 space-y-3 text-sm text-zinc-600">
            <p>Cuando subamos la versión a deploy y quieras probarla con tu cuenta activa, este es el recorrido corto para validar el pipeline real.</p>
            <div className="rounded-component border border-black/10 p-3">
              1. Confirmar `APP_URL`, `SCRAPER_SERVICE_URL`, `SCRAPER_SERVICE_SECRET` y `SCRAPER_MOCK_MODE=false`.
            </div>
            <div className="rounded-component border border-black/10 p-3">
              2. Cargar el cliente real con `seller ID`, `URL ML` y sesión Playwright JSON.
            </div>
            <div className="rounded-component border border-black/10 p-3">
              3. Validar sesión desde configuración del cliente y revisar que quede en estado `Validada`.
            </div>
            <div className="rounded-component border border-black/10 p-3">
              4. Correr scraping manual de `Salud` y verificar `scraping_jobs`.
            </div>
            <div className="rounded-component border border-black/10 p-3">
              5. Ejecutar el dispatch diario y revisar si se consolidó un diagnóstico nuevo.
            </div>
            <p className="font-semibold text-zinc-700">
              Checklist completo documentado en `docs/deploy-checklist.md`.
            </p>
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <h2 className="text-lg font-bold text-zinc-950">Destino app</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>Vercel para Next.js, auth, dashboards y endpoints internos.</p>
              <div className="rounded-component border border-black/10 p-3">
                Claves críticas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `CRON_SECRET`.
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-bold text-zinc-950">Destino scraper</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>Fly.io o Railway para Playwright, validación de sesión y scraping manual/diario.</p>
              <div className="rounded-component border border-black/10 p-3">
                Claves críticas: `SCRAPER_SERVICE_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SCRAPER_MOCK_MODE=false`.
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-bold text-zinc-950">Destino parser y functions</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>Parser en Railway/Fly y Edge Functions en Supabase para cron, reportes y alertas.</p>
              <div className="rounded-component border border-black/10 p-3">
                Asegurar buckets `client-files` y `meli-sessions`, además de `APP_URL` y `CRON_SECRET` compartidos.
              </div>
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-bold">Scraping jobs recientes</h2>
          <div className="mt-4 divide-y divide-black/10">
            {scrapingJobs.map((job) => (
              <div key={job.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_120px_120px_1.4fr]">
                <span className="font-medium">{job.id.slice(0, 8)}</span>
                <span>{job.tipo}</span>
                <span className={job.estado === "error" ? "text-[#791F1F]" : job.estado === "success" ? "text-[#27500A]" : "text-zinc-600"}>{job.estado}</span>
                <span className="text-zinc-500">{job.errorMsg ?? new Date(job.createdAt).toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function ReadinessCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  const Icon = ok ? CheckCircle2 : value === "Pendiente" ? CircleAlert : CircleDashed;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-500">{label}</div>
          <div className="mt-2 text-2xl font-bold text-zinc-950">{value}</div>
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-component ${ok ? "bg-[#EAF3DE] text-[#27500A]" : "bg-[#FAEEDA] text-[#633806]"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
