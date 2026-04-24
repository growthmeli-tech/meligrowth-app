import Link from "next/link";
import { AlertCircle, ClipboardList, FileSpreadsheet, Settings } from "lucide-react";
import { ScoreBadge } from "@/components/score/score-badge";
import { ScoreBar } from "@/components/score/score-bar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isPlaceholderDiagnostic } from "@/lib/data";
import { daysSince } from "@/lib/utils";
import type { Client, Diagnostic, OnboardingStatus, User } from "@/lib/types";

export function ClientCard({
  client,
  diagnostic,
  operator,
  onboardingStatus
}: {
  client: Client;
  diagnostic: Diagnostic;
  operator?: User;
  onboardingStatus: OnboardingStatus;
}) {
  const withoutDiagnostic = isPlaceholderDiagnostic(diagnostic);
  const stale = withoutDiagnostic || daysSince(client.lastUpdatedAt) > 7;
  return (
      <Card className="h-full transition hover:border-brand-purple">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-card bg-brand-light font-bold text-brand-dark">{client.initials}</div>
            <div>
              <Link href={`/operator/clients/${client.id}`} className="font-bold text-zinc-950 hover:text-brand-dark">{client.name}</Link>
              <div className="text-sm text-zinc-500">{operator?.name ?? "Sin operador"}</div>
            </div>
          </div>
          {stale ? <AlertCircle className="h-5 w-5 text-[#E24B4A]" aria-label="Sin actualizar" /> : null}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge className="uppercase">{client.plan}</Badge>
          <Badge className={onboardingTone(onboardingStatus)}>
            {onboardingLabel(onboardingStatus)}
          </Badge>
          {withoutDiagnostic ? <Badge className="bg-[#FAEEDA] text-[#633806]">Sin diagnóstico</Badge> : <ScoreBadge estado={diagnostic.estadoGlobal} />}
        </div>
        <div className="mt-5">
          {withoutDiagnostic ? (
            <div className="rounded-component border border-[#BA7517]/25 bg-[#FAEEDA] p-3 text-sm font-semibold text-[#633806]">
              Cargar diagnóstico inicial para activar score, acciones y evolución.
            </div>
          ) : (
            <ScoreBar score={diagnostic.scoreGlobal} label="Score global" />
          )}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <QuickLink href={`/operator/clients/${client.id}?tab=acciones`} label="Acciones" icon={ClipboardList} />
          <QuickLink href={`/operator/clients/${client.id}/files`} label="Archivos" icon={FileSpreadsheet} />
          <QuickLink href={`/operator/clients/${client.id}/settings`} label="Config" icon={Settings} />
        </div>
      </Card>
  );
}

function onboardingLabel(status: "sin_acceso" | "sin_diagnostico" | "esperando_plantillas" | "operativa") {
  if (status === "sin_acceso") return "Sin acceso";
  if (status === "sin_diagnostico") return "Sin diagnóstico";
  if (status === "esperando_plantillas") return "Esperando plantillas";
  return "Operativa";
}

function onboardingTone(status: "sin_acceso" | "sin_diagnostico" | "esperando_plantillas" | "operativa") {
  if (status === "operativa") return "bg-[#EAF3DE] text-[#27500A]";
  if (status === "esperando_plantillas") return "bg-brand-light text-brand-dark";
  return "bg-[#FAEEDA] text-[#633806]";
}

function QuickLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link href={href} className="focus-ring flex min-h-10 items-center justify-center gap-1 rounded-component border border-black/10 bg-white px-2 text-xs font-semibold text-brand-dark hover:bg-brand-light">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
