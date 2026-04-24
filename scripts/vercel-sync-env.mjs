#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET"
];

const OPTIONAL_KEYS = ["APP_URL", "APP_ENCRYPTION_KEY", "PARSER_SERVICE_URL", "PARSER_SERVICE_SECRET", "SCRAPER_SERVICE_URL", "SCRAPER_SERVICE_SECRET", "SCRAPER_MOCK_MODE", "RESEND_API_KEY", "REPORT_FROM_EMAIL", "SCORE_ALERT_FROM_EMAIL", "SCORE_ALERT_CC_EMAILS"];

function parseDotEnv(filePath) {
  const values = {};
  const source = fs.readFileSync(filePath, "utf8");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalIndex = line.indexOf("=");
    if (equalIndex < 0) continue;
    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function hasValue(value) {
  return typeof value === "string" && value.length > 0;
}

const cwd = process.cwd();
const envPath = path.join(cwd, ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const environments = args.filter((arg) => !arg.startsWith("--"));
const scopeIndex = args.indexOf("--scope");
const projectIndex = args.indexOf("--project");
const scope = scopeIndex >= 0 ? args[scopeIndex + 1] : undefined;
const project = projectIndex >= 0 ? args[projectIndex + 1] : undefined;

if (!scope || !project) {
  console.error("Usage: node scripts/vercel-sync-env.mjs <environment...> --scope <scope> --project <project>");
  process.exit(1);
}

if (environments.length === 0) {
  console.error("Provide at least one Vercel environment: production, preview or development");
  process.exit(1);
}

const envValues = parseDotEnv(envPath);
const availableKeys = [...REQUIRED_KEYS, ...OPTIONAL_KEYS].filter((key) => hasValue(envValues[key]));
const missingRequired = REQUIRED_KEYS.filter((key) => !hasValue(envValues[key]));

if (missingRequired.length > 0) {
  console.error(`Missing required keys in .env.local: ${missingRequired.join(", ")}`);
  process.exit(1);
}

for (const environment of environments) {
  for (const key of availableKeys) {
    execFileSync(
      "npx",
      [
        "vercel",
        "env",
        "add",
        key,
        environment,
        "--scope",
        scope,
        "--value",
        envValues[key],
        "--yes",
        "--force"
      ],
      {
        stdio: "inherit",
        cwd
      }
    );
  }
}

console.log(`Synced ${availableKeys.length} env vars to ${project} for: ${environments.join(", ")}`);
