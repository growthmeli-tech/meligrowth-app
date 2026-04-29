export type EmptyStateContext =
  | "clientes"
  | "cuenta"
  | "diagnosticos"
  | "recomendaciones"
  | "archivos"
  | "notificaciones"
  | "historial"
  | "tareas";

export type EmptyStateProps = {
  context: EmptyStateContext;
  onAction?: () => void;
  loading?: boolean;
  error?: string | null;
};

const EMPTY_STATE_CONFIG: Record<EmptyStateContext, { icon: string; title: string; description: string; cta: string | null }> = {
  cuenta: {
    icon: "🔗",
    title: "No tenés una cuenta operativa asignada",
    description: "Necesitás acceso a una cuenta de Mercado Libre para ver el panel. Coordiná con el equipo interno.",
    cta: null
  },
  diagnosticos: {
    icon: "🩺",
    title: "No hay diagnosticos para esta cuenta todavia",
    description: "Carga el primer diagnostico para empezar a trackear la salud de la cuenta.",
    cta: "Crear primer diagnostico →"
  },
  tareas: {
    icon: "✅",
    title: "Esta cuenta esta al dia",
    description: "No hay tareas pendientes.",
    cta: "Crear tarea manual →"
  },
  clientes: {
    icon: "🏢",
    title: "Todavia no hay cuentas en tu cartera",
    description: "Agrega la primera empresa para empezar a operar.",
    cta: "Agregar empresa →"
  },
  recomendaciones: {
    icon: "💡",
    title: "No hay recomendaciones activas",
    description: "La cuenta no tiene alertas operativas ahora.",
    cta: "Crear accion preventiva →"
  },
  archivos: {
    icon: "📁",
    title: "No hay archivos disponibles",
    description: "Subi documentos para continuar.",
    cta: "Subir archivo →"
  },
  notificaciones: {
    icon: "🔔",
    title: "No hay notificaciones",
    description: "No hay alertas para mostrar ahora.",
    cta: "Volver al dashboard →"
  },
  historial: {
    icon: "📉",
    title: "Sin historial suficiente",
    description: "Sin datos historicos para esta cuenta.",
    cta: "Cargar diagnostico →"
  }
};

export function EmptyState({ context, onAction, loading = false, error = null }: EmptyStateProps) {
  if (loading) {
    return (
      <div className="min-h-[220px] flex flex-col items-center justify-center text-center gap-3 p-6 animate-pulse">
        <div className="h-10 w-10 rounded-full bg-gray-200" />
        <div className="h-5 w-48 rounded bg-gray-200" />
        <div className="h-4 w-56 rounded bg-gray-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[220px] flex flex-col items-center justify-center text-center gap-3 p-6 rounded-xl border border-red-200 bg-red-50">
        <p className="text-lg font-semibold text-red-700">No pudimos cargar este estado vacio</p>
      </div>
    );
  }

  const config = EMPTY_STATE_CONFIG[context];
  return (
    <div className="min-h-[220px] flex flex-col items-center justify-center text-center gap-3 p-4 md:p-6">
      <p className="text-4xl">{config.icon}</p>
      <h3 className="text-base md:text-lg font-semibold text-[#1A1A1A]">{config.title}</h3>
      <p className="text-sm text-[#6B6B6B] max-w-sm">{config.description}</p>
      {config.cta ? (
        <button type="button" onClick={onAction} className="bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-6 py-2.5 hover:brightness-95">
          {config.cta}
        </button>
      ) : null}
    </div>
  );
}
