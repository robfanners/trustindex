// src/lib/env.ts
//
// Validates required environment variables at import time.
// Import this in server-side entry points to fail fast.

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const OPTIONAL_WARN = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "CRON_SECRET",
] as const;

const missing: string[] = [];
const warnings: string[] = [];

for (const key of REQUIRED) {
  if (!process.env[key]) missing.push(key);
}

for (const key of OPTIONAL_WARN) {
  if (!process.env[key]) warnings.push(key);
}

if (missing.length > 0) {
  throw new Error(
    `[env] Missing required environment variables:\n  ${missing.join("\n  ")}\n\nCopy .env.example to .env.local and fill in the values.`
  );
}

if (warnings.length > 0 && process.env.NODE_ENV !== "test") {
  console.warn(
    `[env] Optional environment variables not set (some features will be disabled):\n  ${warnings.join("\n  ")}`
  );
}

/** Validated environment — use this for type-safe access */
export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
} as const;
