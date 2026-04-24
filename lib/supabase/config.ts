function isForcedDemoMode() {
  return process.env.MELIGROWTH_FORCE_DEMO === "1";
}

export function isSupabaseConfigured() {
  return !isForcedDemoMode() && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
}

export function isSupabaseServiceConfigured() {
  return !isForcedDemoMode() && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isParserPipelineConfigured() {
  return Boolean(isSupabaseServiceConfigured() && process.env.PARSER_SERVICE_URL && process.env.PARSER_SERVICE_SECRET);
}

export function isScraperPipelineConfigured() {
  return Boolean(isSupabaseServiceConfigured() && process.env.SCRAPER_SERVICE_URL && process.env.SCRAPER_SERVICE_SECRET);
}

export function isAppEncryptionConfigured() {
  return Boolean(process.env.APP_ENCRYPTION_KEY);
}

export function getSupabaseServiceConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return { url, serviceRoleKey };
}

export type RuntimeCheck = {
  key: string;
  label: string;
  group: "Core" | "Automatización" | "Email";
  configured: boolean;
  requiredFor: string;
  valueHint?: string;
};

function hasEnv(key: string) {
  return Boolean(process.env[key]);
}

export function getRuntimeChecks(): RuntimeCheck[] {
  return [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase URL",
      group: "Core",
      configured: hasEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredFor: "Auth, datos reales y Storage"
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase anon key",
      group: "Core",
      configured: hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      requiredFor: "Sesión web y RLS"
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase service role",
      group: "Core",
      configured: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
      requiredFor: "Jobs internos, parser, cron y reportes"
    },
    {
      key: "CRON_SECRET",
      label: "Cron secret",
      group: "Core",
      configured: hasEnv("CRON_SECRET"),
      requiredFor: "Proteger endpoints internos"
    },
    {
      key: "APP_URL",
      label: "App URL",
      group: "Core",
      configured: hasEnv("APP_URL"),
      requiredFor: "Proxy de Edge Functions a endpoints internos"
    },
    {
      key: "APP_ENCRYPTION_KEY",
      label: "App encryption key",
      group: "Core",
      configured: hasEnv("APP_ENCRYPTION_KEY"),
      requiredFor: "Cifrado de sesiones sensibles y secretos operativos"
    },
    {
      key: "PARSER_SERVICE_URL",
      label: "Parser service URL",
      group: "Automatización",
      configured: hasEnv("PARSER_SERVICE_URL"),
      requiredFor: "Procesamiento de planillas"
    },
    {
      key: "PARSER_SERVICE_SECRET",
      label: "Parser service secret",
      group: "Automatización",
      configured: hasEnv("PARSER_SERVICE_SECRET"),
      requiredFor: "Autenticación del parser"
    },
    {
      key: "SCRAPER_SERVICE_URL",
      label: "Scraper service URL",
      group: "Automatización",
      configured: hasEnv("SCRAPER_SERVICE_URL"),
      requiredFor: "Scraping Mercado Libre"
    },
    {
      key: "SCRAPER_SERVICE_SECRET",
      label: "Scraper service secret",
      group: "Automatización",
      configured: hasEnv("SCRAPER_SERVICE_SECRET"),
      requiredFor: "Autenticación del scraper"
    },
    {
      key: "SCRAPER_MOCK_MODE",
      label: "Scraper mock mode",
      group: "Automatización",
      configured: true,
      requiredFor: "Definir si el scraper usa fixtures o navegación real",
      valueHint: process.env.SCRAPER_MOCK_MODE ?? "true"
    },
    {
      key: "RESEND_API_KEY",
      label: "Resend API key",
      group: "Email",
      configured: hasEnv("RESEND_API_KEY"),
      requiredFor: "Alertas y reportes por email"
    },
    {
      key: "REPORT_FROM_EMAIL",
      label: "Report from email",
      group: "Email",
      configured: hasEnv("REPORT_FROM_EMAIL"),
      requiredFor: "Remitente de reportes semanales"
    },
    {
      key: "SCORE_ALERT_FROM_EMAIL",
      label: "Score alert from email",
      group: "Email",
      configured: hasEnv("SCORE_ALERT_FROM_EMAIL"),
      requiredFor: "Remitente dedicado de alertas críticas"
    },
    {
      key: "SCORE_ALERT_CC_EMAILS",
      label: "Score alert CC emails",
      group: "Email",
      configured: hasEnv("SCORE_ALERT_CC_EMAILS"),
      requiredFor: "Copias operativas opcionales"
    }
  ];
}

export function getRuntimeReadiness() {
  const checks = getRuntimeChecks();
  const requiredCoreKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET", "APP_URL", "APP_ENCRYPTION_KEY"];
  const parserKeys = ["PARSER_SERVICE_URL", "PARSER_SERVICE_SECRET"];
  const scraperKeys = ["SCRAPER_SERVICE_URL", "SCRAPER_SERVICE_SECRET"];
  const emailKeys = ["RESEND_API_KEY", "REPORT_FROM_EMAIL"];

  const hasAll = (keys: string[]) => keys.every((key) => checks.find((check) => check.key === key)?.configured);

  return {
    configured: checks.filter((check) => check.configured).length,
    total: checks.length,
    coreReady: hasAll(requiredCoreKeys),
    parserReady: isParserPipelineConfigured(),
    scraperReady: isScraperPipelineConfigured(),
    emailReady: hasAll(emailKeys),
    automationReady: hasAll(requiredCoreKeys) && hasAll(parserKeys) && hasAll(scraperKeys)
  };
}
