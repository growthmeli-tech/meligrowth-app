import { Button } from "@/components/ui/button";

type EmptyStateContext = "clientes" | "diagnosticos" | "recomendaciones" | "archivos" | "notificaciones" | "historial";

type EmptyStateProps = {
  context: EmptyStateContext;
  onAction?: () => void;
};

const EMPTY_STATE_CONFIG: Record<
  EmptyStateContext,
  { title: string; description: string; cta: string | null; secondary?: string | null }
> = {
  clientes: {
    title: "No tenés clientes activos todavía",
    description: "Agregá tu primer cliente para empezar a gestionar su cuenta de ML.",
    cta: "Agregar primer cliente"
  },
  diagnosticos: {
    title: "Sin diagnósticos para esta cuenta",
    description: "Cargá el primer diagnóstico para empezar a seguir la evolución.",
    cta: "Crear primer diagnóstico"
  },
  recomendaciones: {
    title: "Esta cuenta está al día",
    description: "No hay recomendaciones pendientes por ahora.",
    cta: "Crear acción preventiva"
  },
  archivos: {
    title: "Todavía no hay archivos cargados",
    description: "Subí la plantilla más urgente para avanzar con el análisis.",
    cta: "Subir archivo"
  },
  notificaciones: {
    title: "No hay alertas pendientes",
    description: "Todo está en orden en este momento.",
    cta: "Ir al dashboard"
  },
  historial: {
    title: "Sin historial suficiente",
    description: "Todavía no hay datos para comparar evolución.",
    cta: "Cargar diagnóstico"
  }
};

export function EmptyState({ context, onAction }: EmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[context];

  return (
    <div className="rounded-xl border border-dashed border-black/20 bg-white p-6 text-center">
      <h3 className="text-lg font-bold text-zinc-900">{config.title}</h3>
      <p className="mt-2 text-sm text-zinc-600">{config.description}</p>
      {config.cta ? (
        <div className="mt-4">
          <Button type="button" onClick={onAction}>
            {config.cta}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
