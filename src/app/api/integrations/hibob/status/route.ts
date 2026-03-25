import { NextResponse } from "next/server";
import { requireAuth, apiOk } from "@/lib/apiHelpers";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { data: conn } = await auth.db
    .from("integration_connections")
    .select("status, last_synced_at")
    .eq("organisation_id", auth.orgId)
    .eq("provider", "hibob")
    .single();

  if (!conn) return apiOk({ status: "disconnected" });

  return apiOk({
    status: conn.status,
    last_synced_at: conn.last_synced_at,
  });
}
