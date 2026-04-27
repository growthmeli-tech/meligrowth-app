export type UserRole = "operator" | "client";
export type UserRoleV2 =
  | "super_admin_meli_growth"
  | "internal_operator_meli_growth"
  | "client_manager"
  | "client_operator";

export type ClientPlan = "starter" | "growth" | "scale";
export type DiagnosticSource = "manual" | "scraping" | "import";
export type ActionPriority = "urgente" | "alta" | "media";
export type ActionStatus = "pendiente" | "en_curso" | "completada";
export type FileType = "skus_stock" | "margenes" | "ficha_tecnica" | "otro";
export type ScrapingType = "salud" | "ads" | "publicaciones" | "stock";
export type ScrapingStatus = "pending" | "running" | "success" | "error";
export type NotificationType =
  | "score_bajo"
  | "alerta_critica"
  | "accion_completada"
  | "archivo_procesado"
  | "reporte_semanal";
export type MeliSessionStatus = "missing" | "uploaded" | "validated" | "error";
export type PricingProposalSource = "manual" | "template";

export type PlanType = "360" | "360_copilot";
export type UserAccountAccessType = "manager" | "operator" | "internal";
export type UserAccountAccessFlags = {
  ops_access_enabled: boolean;
};
export type MetricSnapshotSource = "api" | "scraper" | "manual" | "csv";
export type AlertPriority = "urgente" | "alta" | "media" | "baja";
export type AlertAudience = "internal" | "manager" | "operator" | "all";
export type TaskPriority = "urgente" | "alta" | "media" | "baja";
export type TaskStatus = "pendiente" | "en_curso" | "completada" | "descartada";
export type IngestionRunSource = "api" | "scraper" | "manual" | "csv";
export type IngestionRunStatus = "pending" | "running" | "success" | "error";

export type ScoreStatus = "platinum" | "muy_bueno" | "solido" | "en_desarrollo" | "en_riesgo" | "critico";
