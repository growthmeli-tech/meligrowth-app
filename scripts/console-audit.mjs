import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3100";
const publicRoutes = ["/", "/login"];
const operatorBaseRoutes = ["/operator/dashboard", "/operator/pricing", "/operator/notifications", "/operator/settings"];
const clientRoutes = ["/client/dashboard", "/client/metrics", "/client/files", "/client/notifications"];

const issues = [];

function isIgnorableRequestFailure(url, message) {
  if (message !== "net::ERR_ABORTED") return false;
  return (
    url.includes("?_rsc=") ||
    url.includes("/_next/static/webpack/") ||
    url.includes("/_next/static/chunks/") ||
    url === `${baseUrl}/login`
  );
}

function isIgnorableDevRootRedirectIssue(page, issue) {
  const rootUrl = `${baseUrl}/`;

  if (issue.file !== rootUrl) return false;

  if (issue.category === "http" && issue.message === "HTTP 404" && page.url() === "about:blank") {
    return true;
  }

  if (
    issue.category === "console" &&
    issue.message.includes("Failed to load resource") &&
    issue.file === rootUrl
  ) {
    return true;
  }

  return false;
}

function recordIssue(page, issue) {
  if (isIgnorableDevRootRedirectIssue(page, issue)) {
    return;
  }

  issues.push({
    route: page.url(),
    ...issue
  });
}

function instrumentPage(page) {
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") {
      const location = msg.location();
      recordIssue(page, {
        category: "console",
        level: msg.type(),
        message: msg.text(),
        file: location.url || null,
        line: location.lineNumber ?? null
      });
    }
  });

  page.on("pageerror", (error) => {
    recordIssue(page, {
      category: "pageerror",
      level: "error",
      message: error.message,
      file: null,
      line: null
    });
  });

  page.on("requestfailed", (request) => {
    const message = request.failure()?.errorText ?? "Request failed";
    if (isIgnorableRequestFailure(request.url(), message)) {
      return;
    }

    recordIssue(page, {
      category: "requestfailed",
      level: "error",
      message,
      file: request.url(),
      line: null
    });
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      recordIssue(page, {
        category: "http",
        level: "error",
        message: `HTTP ${response.status()}`,
        file: response.url(),
        line: null
      });
    }
  });
}

async function auditRoutes(page, routes) {
  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  }
}

function getServiceSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function resolveOperatorRoutes(credentials) {
  const supabase = getServiceSupabaseClient();
  if (!supabase || !credentials) {
    return [...operatorBaseRoutes];
  }

  const { data: operator } = await supabase.from("users").select("id").eq("email", credentials.email).maybeSingle();
  if (!operator?.id) {
    return [...operatorBaseRoutes];
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("operator_id", operator.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!client?.id) {
    return [...operatorBaseRoutes];
  }

  return [
    ...operatorBaseRoutes,
    `/operator/clients/${client.id}`,
    `/operator/clients/${client.id}/diagnostic/new`,
    `/operator/clients/${client.id}/files`,
    `/operator/clients/${client.id}/settings`
  ];
}

async function login(page, email, password, expectedPathname) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => url.pathname === expectedPathname, { timeout: 15_000 });
}

async function runScope(label, routes, credentials) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  instrumentPage(page);

  if (credentials) {
    await login(page, credentials.email, credentials.password, credentials.expectedPathname);
  }

  const resolvedRoutes = label === "operator" ? await resolveOperatorRoutes(credentials) : routes;

  await auditRoutes(page, resolvedRoutes);
  await browser.close();

  return { label, auditedRoutes: resolvedRoutes.length };
}

const scopes = [
  {
    label: "public",
    routes: publicRoutes,
    enabled: true
  },
  {
    label: "operator",
    routes: operatorBaseRoutes,
    enabled: true,
    credentials:
      process.env.AUDIT_OPERATOR_EMAIL && process.env.AUDIT_OPERATOR_PASSWORD
        ? {
            email: process.env.AUDIT_OPERATOR_EMAIL,
            password: process.env.AUDIT_OPERATOR_PASSWORD,
            expectedPathname: "/operator/dashboard"
          }
        : null
  },
  {
    label: "client",
    routes: clientRoutes,
    enabled: true,
    credentials:
      process.env.AUDIT_CLIENT_EMAIL && process.env.AUDIT_CLIENT_PASSWORD
        ? {
            email: process.env.AUDIT_CLIENT_EMAIL,
            password: process.env.AUDIT_CLIENT_PASSWORD,
            expectedPathname: "/client/dashboard"
          }
        : null
  }
];

const summary = [];

for (const scope of scopes) {
  if (!scope.enabled) continue;

  const credentials = scope.credentials ?? null;
  const demoAllowed = scope.label === "public" || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!credentials && !demoAllowed && scope.label !== "public") {
    summary.push({
      scope: scope.label,
      status: "skipped",
      reason: "Missing AUDIT_* credentials for authenticated Supabase audit"
    });
    continue;
  }

  const result = await runScope(scope.label, scope.routes, credentials);
  summary.push({
    scope: scope.label,
    status: credentials ? "authenticated" : "demo",
    auditedRoutes: result.auditedRoutes
  });
}

const output = { summary, issues };
console.log(JSON.stringify(output, null, 2));

if (issues.length > 0) {
  process.exitCode = 1;
}
