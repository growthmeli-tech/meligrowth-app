export const DESIGN_TOKENS = {
  colors: {
    primary: "#FFD600",
    dark: "#1A1A1A",
    white: "#FFFFFF",
    background: "#F5F5F0",
    border: "#E8E8E2",
    textSecondary: "#6B6B6B"
  },
  score: {
    platinum: {
      min: 95,
      max: 100,
      color: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      label: "Platinum"
    },
    muy_bueno: {
      min: 85,
      max: 94,
      color: "#22C55E",
      bg: "#DCFCE7",
      border: "#BBF7D0",
      label: "Muy bueno"
    },
    solido: {
      min: 70,
      max: 84,
      color: "#2563EB",
      bg: "#EFF6FF",
      border: "#BFDBFE",
      label: "Sólido"
    },
    en_desarrollo: {
      min: 55,
      max: 69,
      color: "#D97706",
      bg: "#FFFBEB",
      border: "#FDE68A",
      label: "En desarrollo"
    },
    en_riesgo: {
      min: 40,
      max: 54,
      color: "#EA580C",
      bg: "#FFF7ED",
      border: "#FED7AA",
      label: "En riesgo"
    },
    critico: {
      min: 0,
      max: 39,
      color: "#DC2626",
      bg: "#FEF2F2",
      border: "#FECACA",
      label: "Crítico"
    }
  },
  alerts: {
    critico: {
      level: 1,
      color: "#DC2626",
      bg: "#FEF2F2",
      text: "#7F1D1D",
      label: "Crítico"
    },
    urgente: {
      level: 2,
      color: "#EA580C",
      bg: "#FFF7ED",
      text: "#9A3412",
      label: "Urgente"
    },
    importante: {
      level: 3,
      color: "#D97706",
      bg: "#FFFBEB",
      text: "#92400E",
      label: "Importante"
    },
    informativa: {
      level: 4,
      color: "#2563EB",
      bg: "#EFF6FF",
      text: "#1E3A8A",
      label: "Informativa"
    }
  },
  typography: {
    display: "font-black",
    heading: "font-bold",
    body: "font-medium",
    secondary: "font-normal",
    mono: "font-mono",
    sizes: {
      scoreGlobal: "text-6xl",
      scoreBlock: "text-2xl",
      sectionTitle: "text-sm",
      body: "text-sm",
      hint: "text-xs"
    },
    tracking: {
      sectionTitle: "tracking-wider"
    }
  },
  spacing: {
    cardPadding: {
      mobile: "p-4",
      desktop: "p-6"
    },
    gap: {
      mobile: "gap-3",
      desktop: "gap-4"
    },
    section: {
      compact: "space-y-3",
      default: "space-y-6"
    }
  },
  radius: {
    card: "rounded-xl",
    component: "rounded-component",
    pill: "rounded-full"
  },
  shadows: {
    card: "shadow-sm",
    hover: "shadow-md",
    elevated: "shadow-lg"
  },
  motion: {
    scoreCountMs: 700,
    progressBarMs: 450,
    hoverMs: 150,
    badgePulseMs: 1600
  },
  breakpoints: {
    mobile: 0,
    tablet: 768,
    desktop: 1280
  },
  layout: {
    maxContentWidth: 1440,
    sidebarWidth: 264,
    operatorHeaderHeight: 64,
    mobileBottomBarHeight: 68
  }
} as const;

export type ScoreStatusKey = keyof typeof DESIGN_TOKENS.score;
export type AlertPriorityKey = keyof typeof DESIGN_TOKENS.alerts;
