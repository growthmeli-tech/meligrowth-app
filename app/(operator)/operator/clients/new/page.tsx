import { ArrowRight, CheckCircle2, FileSpreadsheet, ShieldCheck, Store } from "lucide-react";
import { createClientOnboarding } from "@/app/(operator)/operator/clients/new/actions";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAvailableClientUsers } from "@/lib/data";

const checklist = [
  {
    icon: Store,
    title: "Cuenta y plan",
    copy: "Nombre comercial, plan contratado y datos de Mercado Libre."
  },
  {
    icon: ShieldCheck,
    title: "Acceso cliente",
    copy: "Asociación opcional a un usuario cliente existente en Supabase Auth."
  },
  {
    icon: FileSpreadsheet,
    title: "Primeras tareas",
    copy: "Se crean acciones iniciales para diagnóstico, stock y márgenes."
  }
];

export default async function NewClientPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const clientUsers = await getAvailableClientUsers();

  return (
    <AppShell mode="operator">
      <div className="space-y-6">
        <div>
          <div className="text-sm font-semibold text-brand-dark">Onboarding operativo</div>
          <h1 className="mt-1 text-3xl font-bold text-zinc-950">Nuevo cliente</h1>
          <p className="mt-2 max-w-3xl text-zinc-600">
            Alta guiada para dejar la cuenta lista para diagnóstico inicial, carga de archivos y automatización.
          </p>
        </div>

        {resolvedSearchParams.error ? (
          <div className="rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]">
            {resolvedSearchParams.error === "missing" ? "Ingresá al menos el nombre del cliente." : "No se pudo crear el cliente. Revisá permisos y datos cargados."}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <form action={createClientOnboarding} className="space-y-5 rounded-card border border-black/10 bg-white p-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">Datos de la cuenta</h2>
              <p className="mt-1 text-sm text-zinc-600">Estos datos alimentan la cartera operator y el dashboard cliente.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-zinc-700">Nombre del cliente</span>
                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="name" placeholder="Tienda Pampa" required />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">Plan</span>
                <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="plan" defaultValue="growth">
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="scale">Scale</option>
                </select>
              </label>

	              <label className="space-y-2">
	                <span className="text-sm font-semibold text-zinc-700">Email de acceso cliente</span>
	                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="client_email" placeholder="cliente@empresa.com" type="email" />
	              </label>

	              <label className="space-y-2 md:col-span-2">
	                <span className="text-sm font-semibold text-zinc-700">Vincular usuario cliente existente</span>
	                <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="client_user_id" defaultValue="">
	                  <option value="">Sin vincular por ahora</option>
	                  {clientUsers.map((user) => (
	                    <option key={user.id} value={user.id}>{user.name} · {user.email}</option>
	                  ))}
	                </select>
	              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">URL cuenta Mercado Libre</span>
                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="meli_account_url" placeholder="https://www.mercadolibre.com.ar/perfil/..." type="url" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">Seller ID</span>
                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="meli_seller_id" placeholder="1849201" />
              </label>
            </div>

            <div className="rounded-card border border-[#BA7517]/30 bg-[#FAEEDA] p-4 text-sm text-[#633806]">
              Si el email cliente todavía no existe en Supabase Auth, podés dejarlo vacío y asociarlo más adelante.
            </div>

            <Button type="submit">
              Crear cliente y seguir
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="space-y-4">
            {checklist.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title}>
                  <div className="flex gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-component bg-brand-light text-brand-purple">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-zinc-950">{item.title}</h2>
                      <p className="mt-1 text-sm text-zinc-600">{item.copy}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
            <Card>
              <div className="flex gap-3">
                <CheckCircle2 className="mt-1 h-5 w-5 text-[#639922]" />
                <div>
                  <h2 className="font-bold text-zinc-950">Siguiente paso automático</h2>
                  <p className="mt-1 text-sm text-zinc-600">Después del alta vas directo al diagnóstico inicial para activar score e historial.</p>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
