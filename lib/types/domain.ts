import type {
  ActionPriority,
  ActionStatus,
  ClientPlan,
  DiagnosticSource,
  FileType,
  MeliSessionStatus,
  NotificationType,
  PricingProposalSource,
  ScrapingStatus,
  ScrapingType,
  UserRole
} from "@/lib/types/enums";

export type Plan = ClientPlan;
export type Priority = ActionPriority;
export type BlockKey = "salud" | "publicaciones" | "ads" | "logistica" | "stock";
export type OnboardingStatus = "sin_acceso" | "sin_diagnostico" | "esperando_plantillas" | "operativa";
export type Estado = "platinum" | "solido" | "desarrollo" | "riesgo" | "critico";
export type ScrapingJobStatus = ScrapingStatus;

export type User = {
  id: string;
  email: string;
  role: UserRole;
  name: string;
};

export type Client = {
  id: string;
  name: string;
  initials: string;
  plan: Plan;
  operatorId: string;
  clientUserId?: string;
  meliAccountUrl: string;
  meliSellerId: string;
  active: boolean;
  lastUpdatedAt: string;
};

export type SaludData = {
  reclamos: number;
  mediaciones: number;
  cancelaciones_vendedor: number;
  envios_a_tiempo: number;
};

export type PublicacionesData = {
  pubs_activas_pct: number;
  pubs_optimizadas_pct: number;
  ctr: number;
};

export type AdsData = {
  margen_pre_ads: number;
  gasto_ads: number;
  ventas_ads: number;
  ventas_totales: number;
  acos: number;
  roas: number;
  tacos: number;
};

export type LogisticaData = {
  incidencias_pct: number;
  uso_full_flex_pct: number;
  cancelaciones_stock_pct: number;
};

export type StockData = {
  skus_sin_stock_pct: number;
  dias_stock: number;
  lead_time_reposicion: number;
  sistema_reposicion: number;
};

export type DiagnosticInput = {
  salud: SaludData;
  publicaciones: PublicacionesData;
  ads: AdsData;
  logistica: LogisticaData;
  stock: StockData;
};

export type BloqueScores = Record<BlockKey, number>;

export type Diagnostic = DiagnosticInput & {
  id: string;
  clientId: string;
  date: string;
  scoreGlobal: number;
  estadoGlobal: Estado;
  scores: BloqueScores;
  source: DiagnosticSource;
};

export type Action = {
  id: string;
  clientId: string;
  bloque: BlockKey;
  titulo: string;
  descripcion: string;
  prioridad: Priority;
  estado: ActionStatus;
  responsable: string;
  dueDate: string;
  completedAt?: string;
};

export type ClientFile = {
  id: string;
  clientId: string;
  tipo: FileType;
  filename: string;
  sizeBytes: number;
  procesado: boolean;
  errorProcesamiento?: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  clientId?: string;
  userId?: string;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
};

export type Decision = {
  title: string;
  description: string;
  priority: Priority;
  block: BlockKey;
};

export type PricingProposal = {
  id: string;
  clientId: string;
  clientName: string;
  createdBy?: string;
  source: PricingProposalSource;
  plan: Plan;
  currentRevenue: number;
  projectedRevenue: number;
  grossMarginPct: number;
  deliveryCost: number;
  setupFee: number;
  months: number;
  fixedFee: number;
  variableCommission: number;
  monthlyFee: number;
  operatorProfit: number;
  operatorMarginPct: number;
  totalContractValue: number;
  paybackRatio: number;
  recommended: boolean;
  notes?: string;
  createdAt: string;
};

export type MeliSession = {
  id: string;
  clientId: string;
  sellerId?: string;
  storagePath: string;
  status: MeliSessionStatus;
  source: string;
  lastValidatedAt?: string;
  lastError?: string;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

export type PricingTemplateFile = {
  id: string;
  clientId: string;
  clientName: string;
  filename: string;
  createdAt: string;
};

export type ScrapingJobSummary = {
  id: string;
  clientId: string | null;
  mlAccountId?: string | null;
  tipo: ScrapingType;
  estado: ScrapingJobStatus;
  errorMsg?: string | null;
  createdAt: string;
};
