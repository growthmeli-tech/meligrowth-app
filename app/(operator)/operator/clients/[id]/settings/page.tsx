import Link from "next/link";
import { ArrowLeft, Play, Save, ShieldCheck, UserRoundCheck } from "lucide-react";
import { runScrapingJob, updateClientSettings, uploadMeliSessionFile, validateMeliSession } from "@/app/(operator)/operator/clients/[id]/settings/actions";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAvailableClientUsers, getClientOnboardingStatus, getClientScrapingJobs, getLatestMeliSession, getOperatorClientBundle } from "@/lib/data";
import { getRuntimeReadiness } from "@/lib/supabase/config";

export default async function ClientSettingsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; session_saved?: string; session_validated?: string; job_started?: string; consolidated?: string; job_tipo?: string; error?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { client, diagnostic, files } = await getOperatorClientBundle(resolvedParams.id);
  const clientUsers = await getAvailableClientUsers();
  const meliSession = await getLatestMeliSession(client.id);
  const scrapingJobs = await getClientScrapingJobs(client.id);
  const onboardingStatus = getClientOnboardingStatus({ client, diagnostic, files });
  const readiness = getRuntimeReadiness();
  const action = updateClientSettings.bind(null, client.id) as unknown as (formData: FormData) => Promise<void>;
  const uploadSessionAction = uploadMeliSessionFile.bind(null, client.id) as unknown as (formData: FormData) => Promise<void>;
  const validateSessionAction = validateMeliSession.bind(null, client.id) as unknown as (formData: FormData) => Promise<void>;
  const runScrapingAction = runScrapingJob.bind(null, client.id) as unknown as (formData: FormData) => Promise<void>;

  return (
    <AppShell mode="operator">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link href={`/operator/clients/${client.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-dark">
              <ArrowLeft className="h-4 w-4" />
              Volver al cliente
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-zinc-950">Configuración de cliente</h1>
            <p className="mt-2 text-zinc-600">Editá datos comerciales, acceso cliente y estado operativo.</p>
          </div>
        </div>

        {resolvedSearchParams.saved ? <Notice tone="success" text="Cliente actualizado correctamente." /> : null}
        {resolvedSearchParams.session_saved ? <Notice tone="success" text="Sesión Mercado Libre subida correctamente." /> : null}
        {resolvedSearchParams.session_validated ? <Notice tone="success" text="Sesión Mercado Libre validada contra el scraper." /> : null}
        {resolvedSearchParams.job_started ? <Notice tone="success" text={`Scraping manual lanzado para ${labelJobType(resolvedSearchParams.job_tipo)}.${resolvedSearchParams.consolidated ? " Ya quedó consolidado en diagnóstico." : ""}`} /> : null}
        {resolvedSearchParams.error === "missing" ? <Notice tone="error" text="El nombre del cliente es obligatorio." /> : null}
        {resolvedSearchParams.error === "missing_session" ? <Notice tone="error" text="Subí un archivo JSON de sesión antes de validar." /> : null}
        {resolvedSearchParams.error === "session_format" ? <Notice tone="error" text="La sesión debe ser un archivo .json exportado por Playwright." /> : null}
        {resolvedSearchParams.error === "session_encryption" ? <Notice tone="error" text="Falta APP_ENCRYPTION_KEY. No guardamos sesiones ML sin cifrado." /> : null}
        {resolvedSearchParams.error === "session_upload" ? <Notice tone="error" text="No pudimos guardar el archivo de sesión en Storage." /> : null}
        {resolvedSearchParams.error === "scraper_config" ? <Notice tone="error" text="Falta configurar SCRAPER_SERVICE_URL o SCRAPER_SERVICE_SECRET para usar scraping real." /> : null}
        {resolvedSearchParams.error === "session_validation_failed" ? <Notice tone="error" text="La validación real de la sesión falló. Revisá captcha, login o disponibilidad del scraper." /> : null}
        {resolvedSearchParams.error === "invalid_job_type" ? <Notice tone="error" text="El bloque seleccionado para scraping no es válido." /> : null}
        {resolvedSearchParams.error === "job_insert" ? <Notice tone="error" text="No pudimos registrar el scraping job en Supabase." /> : null}
        {resolvedSearchParams.error === "job_run" ? <Notice tone="error" text={`El scraping manual para ${labelJobType(resolvedSearchParams.job_tipo)} falló. Revisá la tabla de jobs abajo.`} /> : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <form action={action} className="space-y-5 rounded-card border border-black/10 bg-white p-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">Datos principales</h2>
              <p className="mt-1 text-sm text-zinc-600">Estos campos impactan cartera, dashboard cliente y automatizaciones.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-zinc-700">Nombre del cliente</span>
                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="name" defaultValue={client.name} required />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">Plan</span>
                <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="plan" defaultValue={client.plan}>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="scale">Scale</option>
                </select>
              </label>

	              <label className="space-y-2">
	                <span className="text-sm font-semibold text-zinc-700">Email usuario cliente</span>
	                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="client_email" placeholder="cliente@empresa.com" type="email" />
	              </label>

	              <label className="space-y-2 md:col-span-2">
	                <span className="text-sm font-semibold text-zinc-700">Usuario cliente vinculado</span>
	                <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="client_user_id" defaultValue={client.clientUserId ?? ""}>
	                  <option value="">Sin vincular por ahora</option>
	                  {clientUsers.map((user) => (
	                    <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
	                  ))}
	                </select>
	              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">URL cuenta Mercado Libre</span>
                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="meli_account_url" defaultValue={client.meliAccountUrl} type="url" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">Seller ID</span>
                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="meli_seller_id" defaultValue={client.meliSellerId} />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-card border border-black/10 p-4">
              <input className="h-4 w-4 accent-[#534AB7]" name="active" type="checkbox" defaultChecked={client.active} />
              <span>
                <span className="block text-sm font-semibold text-zinc-950">Cliente activo</span>
                <span className="block text-sm text-zinc-500">Las cuentas inactivas salen de la cartera principal y de automatizaciones diarias.</span>
              </span>
            </label>

            <Button type="submit">
              <Save className="h-4 w-4" />
              Guardar cambios
            </Button>
          </form>

          <div className="space-y-4">
	            <Card>
	              <UserRoundCheck className="h-5 w-5 text-brand-purple" />
              <h2 className="mt-3 font-bold text-zinc-950">Asociación de usuario</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Para vincular acceso cliente, primero creá el usuario en Supabase Auth y en `public.users` con rol `client`. Luego cargá su email acá.
              </p>
	            </Card>
            <Card>
              <ShieldCheck className="h-5 w-5 text-brand-purple" />
              <h2 className="mt-3 font-bold text-zinc-950">Sesión Mercado Libre</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Subí el `storage state` JSON del vendedor para que el scraper pueda navegar panel reputación, publicaciones, ads y stock sin relogin manual.
              </p>
              <div className="mt-4 rounded-component border border-black/10 p-3 text-sm text-zinc-600">
                Estado actual: <strong>{labelSessionStatus(meliSession?.status ?? "missing")}</strong>
                <br />
                Seller ID sesión: <strong>{meliSession?.sellerId ?? client.meliSellerId ?? "Sin cargar"}</strong>
                <br />
                Última validación: <strong>{meliSession?.lastValidatedAt ? new Date(meliSession.lastValidatedAt).toLocaleDateString("es-AR") : "Pendiente"}</strong>
                {meliSession?.lastError ? (
                  <>
                    <br />
                    Error: <strong>{meliSession.lastError}</strong>
                  </>
                ) : null}
              </div>
              <form action={uploadSessionAction} className="mt-4 space-y-3">
                <input type="hidden" name="seller_id" value={client.meliSellerId} />
                <input className="block w-full text-sm" name="file" type="file" accept=".json,application/json" required />
                <Button type="submit" variant="secondary">Subir sesión JSON</Button>
              </form>
              <form action={validateSessionAction} className="mt-3">
                <Button type="submit">Validar sesión real</Button>
              </form>
              {meliSession?.warnings?.length ? (
                <div className="mt-3 rounded-component border border-[#FAEEDA] bg-[#FFFBF2] p-3 text-sm text-[#633806]">
                  Warnings: {meliSession.warnings.join(", ")}
                </div>
              ) : null}
            </Card>
            <Card>
              <h2 className="font-bold text-zinc-950">Scraping manual</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Útil para probar una cuenta puntual sin esperar el cron. Cada corrida crea un job, ejecuta el scraper y, si ya están los 4 bloques del día, consolida diagnóstico automático.
              </p>
              <div className="mt-3 rounded-component border border-black/10 p-3 text-sm text-zinc-600">
                Pipeline scraper: <strong>{readiness.scraperReady ? "Listo" : "Pendiente"}</strong>
              </div>
              <div className="mt-4 grid gap-2">
                {(["salud", "publicaciones", "ads", "stock"] as const).map((tipo) => (
                  <form key={tipo} action={runScrapingAction}>
                    <input type="hidden" name="tipo" value={tipo} />
                    <Button type="submit" variant="secondary" className="w-full justify-between" disabled={!readiness.scraperReady}>
                      <span>Scrapear {labelJobType(tipo)}</span>
                      <Play className="h-4 w-4" />
                    </Button>
                  </form>
                ))}
              </div>
            </Card>
		            <Card>
	              <h2 className="font-bold text-zinc-950">Estado actual</h2>
	              <div className="mt-3 text-sm text-zinc-600">
	                Plan: <strong>{client.plan}</strong>
	                <br />
	                Seller ID: <strong>{client.meliSellerId || "Sin cargar"}</strong>
	                <br />
	                Estado: <strong>{client.active ? "Activo" : "Inactivo"}</strong>
	                <br />
	                Onboarding: <strong>{labelOnboardingStatus(onboardingStatus)}</strong>
	              </div>
	            </Card>
          </div>
        </section>

        <Card>
          <h2 className="text-lg font-bold text-zinc-950">Jobs recientes de este cliente</h2>
          <div className="mt-4 divide-y divide-black/10">
            {scrapingJobs.length === 0 ? (
              <div className="py-4 text-sm text-zinc-500">Todavía no hay corridas manuales o automáticas para esta cuenta.</div>
            ) : (
              scrapingJobs.map((job) => (
                <div key={job.id} className="grid gap-2 py-3 text-sm md:grid-cols-[120px_140px_120px_1fr]">
                  <span className="font-medium">{job.id.slice(0, 8)}</span>
                  <span>{labelJobType(job.tipo)}</span>
                  <span className={job.estado === "error" ? "text-[#791F1F]" : job.estado === "success" ? "text-[#27500A]" : "text-zinc-600"}>{job.estado}</span>
                  <span className="text-zinc-500">{job.errorMsg ?? new Date(job.createdAt).toLocaleString("es-AR")}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function labelOnboardingStatus(status: "sin_acceso" | "sin_diagnostico" | "esperando_plantillas" | "operativa") {
  if (status === "sin_acceso") return "Sin acceso cliente";
  if (status === "sin_diagnostico") return "Sin diagnóstico";
  if (status === "esperando_plantillas") return "Esperando plantillas";
  return "Operativa";
}

function labelSessionStatus(status: "missing" | "uploaded" | "validated" | "error") {
  if (status === "uploaded") return "Subida";
  if (status === "validated") return "Validada";
  if (status === "error") return "Con error";
  return "Sin sesión";
}

function labelJobType(tipo?: string) {
  if (tipo === "salud") return "Salud";
  if (tipo === "publicaciones") return "Publicaciones";
  if (tipo === "ads") return "Ads";
  if (tipo === "stock") return "Stock";
  return "el bloque";
}

function Notice({ text, tone }: { text: string; tone: "success" | "error" }) {
  return (
    <div className={tone === "success" ? "rounded-card border border-[#639922]/30 bg-[#EAF3DE] p-4 text-sm font-semibold text-[#27500A]" : "rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]"}>
      {text}
    </div>
  );
}
