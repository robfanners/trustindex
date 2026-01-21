import fs from "node:fs";

const envPath = ".env.local";
if (!fs.existsSync(envPath)) {
  console.log("MISSING .env.local in repo root");
  process.exit(1);
}

const raw = fs.readFileSync(envPath, "utf8");

// minimal parse of KEY=VALUE lines
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  const k = line.slice(0, idx).trim();
  const v = line.slice(idx + 1).trim();
  if (!(k in process.env)) process.env[k] = v;
}

console.log("Presence:");
console.log({
  NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  SYSADMIN_CODE: !!process.env.SYSADMIN_CODE,
  VERISUM_ADMIN_CODE: !!process.env.VERISUM_ADMIN_CODE,
});

console.log("\nKeys found in .env.local (masked):");
console.log(
  raw
    .split(/\r?\n/)
    .filter(l => /SUPABASE|SYSADMIN|VERISUM/.test(l))
    .map(l => l.replace(/=.*/, "=***"))
    .join("\n")
);
