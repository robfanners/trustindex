import { NextResponse } from "next/server";
import { requireAuth, apiError, apiOk } from "@/lib/apiHelpers";
import { validateCredentials } from "@/lib/hibob";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { serviceId, token } = await req.json();
  if (!serviceId || !token) {
    return apiError("serviceId and token are required", 400);
  }

  // Validate credentials against HiBob API
  const valid = await validateCredentials(serviceId, token);
  if (!valid) {
    return apiError("Invalid HiBob credentials", 401);
  }

  // Upsert into integration_connections
  const { error } = await auth.db
    .from("integration_connections")
    .upsert(
      {
        organisation_id: auth.orgId,
        provider: "hibob",
        status: "connected",
        access_token: serviceId,
        refresh_token: token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organisation_id,provider" }
    );

  if (error) return apiError(error.message, 500);
  return apiOk({ ok: true, status: "connected" });
}
