export const DESIGN_TOKENS = {
  colors: {
    primary: "#FFD600",
    dark: "#1A1A1A",
    background: "#F5F5F0",
    cardBg: "#FFFFFF",
    border: "#E8E8E2",
    textPrimary: "#1A1A1A",
    textSecondary: "#6B6B6B"
  },
  plans: {
    plan360: {
      key: "360",
      label: "360°",
      accent: "#2563EB",
      accentBg: "#EFF6FF",
      accentBorder: "#BFDBFE",
      badgeClassName: "bg-blue-50 text-blue-700 border-blue-200",
      leftBorderClassName: "border-l-4 border-l-blue-600"
    },
    copilot360: {
      key: "360_copilot",
      label: "Copilot",
      accent: "#FFD600",
      accentBg: "#FFFBE6",
      accentBorder: "#FCD34D",
      badgeClassName: "bg-yellow-300 text-[#1A1A1A] border-yellow-400",
      leftBorderClassName: "border-l-4 border-l-yellow-400"
    }
  },
  score: {
    platinum: {
      min: 95,
      max: 100,
      color: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      label: "Platinum",
      chipClassName: "bg-emerald-100 text-emerald-800 border-emerald-200",
      progressClassName: "bg-emerald-600"
    },
    muy_bueno: {
      min: 85,
      max: 94,
      color: "#22C55E",
      bg: "#DCFCE7",
      border: "#BBF7D0",
      label: "Muy bueno",
      chipClassName: "bg-green-100 text-green-700 border-green-200",
      progressClassName: "bg-green-500"
    },
    solido: {
      min: 70,
      max: 84,
      color: "#2563EB",
      bg: "#EFF6FF",
      border: "#BFDBFE",
      label: "Sólido",
      chipClassName: "bg-blue-100 text-blue-700 border-blue-200",
      progressClassName: "bg-blue-600"
    },
    en_desarrollo: {
      min: 55,
      max: 69,
      color: "#D97706",
      bg: "#FFFBEB",
      border: "#FDE68A",
      label: "En desarrollo",
      chipClassName: "bg-amber-100 text-amber-700 border-amber-200",
      progressClassName: "bg-amber-600"
    },
    en_riesgo: {
      min: 40,
      max: 54,
      color: "#EA580C",
      bg: "#FFF7ED",
      border: "#FED7AA",
      label: "En riesgo",
      chipClassName: "bg-orange-100 text-orange-700 border-orange-200",
      progressClassName: "bg-orange-600"
    },
    critico: {
      min: 0,
      max: 39,
      color: "#DC2626",
      bg: "#FEF2F2",
      border: "#FECACA",
      label: "Crítico",
      chipClassName: "bg-red-100 text-red-700 border-red-200",
      progressClassName: "bg-red-600"
    }
  },
  alerts: {
    urgente: {
      level: 1,
      color: "#DC2626",
      bg: "#FEF2F2",
      text: "#7F1D1D",
      label: "Urgente",
      chipClassName: "bg-red-100 text-red-800 border-red-200",
      leftBorderClassName: "border-l-4 border-l-red-600"
    },
    alta: {
      level: 2,
      color: "#EA580C",
      bg: "#FFF7ED",
      text: "#9A3412",
      label: "Alta",
      chipClassName: "bg-orange-100 text-orange-800 border-orange-200",
      leftBorderClassName: "border-l-4 border-l-orange-600"
    },
    media: {
      level: 3,
      color: "#D97706",
      bg: "#FFFBEB",
      text: "#92400E",
      label: "Media",
      chipClassName: "bg-amber-100 text-amber-800 border-amber-200",
      leftBorderClassName: "border-l-4 border-l-amber-500"
    },
    baja: {
      level: 4,
      color: "#2563EB",
      bg: "#EFF6FF",
      text: "#1E3A8A",
      label: "Baja",
      chipClassName: "bg-blue-100 text-blue-800 border-blue-200",
      leftBorderClassName: "border-l-4 border-l-blue-600"
    }
  },
  typography: {
    displayScoreClassName: "text-6xl font-black",
    headerClassName: "text-xl font-bold",
    sectionLabelClassName: "text-xs font-bold uppercase tracking-widest text-[#6B6B6B]",
    bodyClassName: "text-sm font-medium",
    metricClassName: "font-mono text-sm font-medium",
    captionClassName: "text-xs text-[#6B6B6B] font-medium",
    sizes: {
      scoreGlobal: "text-6xl",
      scoreBlock: "text-2xl",
      sectionTitle: "text-xs",
      body: "text-sm",
      hint: "text-xs"
    },
    tracking: {
      sectionTitle: "tracking-widest"
    }
  },
  spacing: {
    page: {
      mobileX: "px-4",
      desktopX: "px-8",
      sectionY: "py-6"
    },
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
    component: "rounded-lg",
    pill: "rounded-full"
  },
  shadows: {
    card: "shadow-sm",
    hover: "shadow-md",
    elevated: "shadow-lg",
    alert: "shadow-[0_0_0_1px_rgba(220,38,38,0.08),0_10px_24px_rgba(220,38,38,0.12)]"
  },
  motion: {
    defaultEasing: "cubic-bezier(0.22, 1, 0.36, 1)",
    fastMs: 150,
    normalMs: 250,
    slowMs: 450,
    scoreCountMs: 700,
    progressBarMs: 450,
    hoverMs: 150,
    badgePulseMs: 1600,
    pulseKeyframe: "pulse-soft"
  },
  breakpoints: {
    xs: 0,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    "2xl": 1536
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
