import type { Estado, Priority } from "@/lib/types";

export const estadoLabels: Record<Estado, string> = {
  platinum: "Platinum",
  solido: "Sólido",
  desarrollo: "En desarrollo",
  riesgo: "En riesgo",
  critico: "Crítico"
};

export const estadoColors: Record<Estado, { fill: string; bg: string; text: string }> = {
  platinum: { fill: "#534AB7", bg: "#EEEDFE", text: "#3C3489" },
  solido: { fill: "#639922", bg: "#EAF3DE", text: "#27500A" },
  desarrollo: { fill: "#BA7517", bg: "#FAEEDA", text: "#633806" },
  riesgo: { fill: "#D85A30", bg: "#FAECE7", text: "#712B13" },
  critico: { fill: "#E24B4A", bg: "#FCEBEB", text: "#791F1F" }
};

export const priorityLabels: Record<Priority, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Media"
};

export const blockLabels = {
  salud: "Salud",
  publicaciones: "Publicaciones",
  ads: "Ads",
  logistica: "Logística",
  stock: "Stock"
};

export const clientBlockLabels = {
  salud: "Salud de cuenta",
  publicaciones: "Publicaciones",
  ads: "Publicidad",
  logistica: "Logística",
  stock: "Stock"
};
