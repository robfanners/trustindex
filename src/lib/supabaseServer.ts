import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      `Missing ${!url ? "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL" : ""}${!url && !serviceKey ? " or " : ""}${
        !serviceKey ? "SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" : ""
      } for server client.`
    );
  }

  return createClient(url, serviceKey);
}
