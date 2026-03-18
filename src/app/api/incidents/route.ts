import { requireAuth, apiOk, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import { maxIncidentsPerMonth } from "@/lib/entitlements";
import { writeAuditLog } from "@/lib/audit";
import { createIncidentSchema, updateIncidentSchema } from "@/lib/validations";

// GET — list incidents for org
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, plan, db } = auth;

    // Optional status filter
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    let query = db
      .from("incidents")
      .select("*, ai_vendors(vendor_name)")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data: incidents, error } = await query;

    if (error) {
      throw new Error("Failed to fetch incidents");
    }

    // Monthly count for limit check
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyCount } = await db
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .gte("created_at", startOfMonth.toISOString());

    const limit = maxIncidentsPerMonth(plan);

    return apiOk({
      incidents: incidents ?? [],
      monthlyCount: monthlyCount ?? 0,
      monthlyLimit: limit === Infinity ? -1 : limit,
    });
  });
}

// POST — create incident
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, plan, db } = auth;

    // Check monthly limit
    const limit = maxIncidentsPerMonth(plan);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await db
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId)
      .gte("created_at", startOfMonth.toISOString());

    if ((count ?? 0) >= limit) {
      throw new Error("Monthly incident limit reached. Upgrade for unlimited.");
    }

    const parsed = await parseBody(req, createIncidentSchema);
    if (parsed.error) return parsed.error;
    const { title, description, aiVendorId, impactLevel, sourceEscalationId, sourceSignalId, systemId } = parsed.data;

    const { data: incident, error } = await db
      .from("incidents")
      .insert({
        organisation_id: orgId,
        title,
        description: description || null,
        ai_vendor_id: aiVendorId || null,
        impact_level: impactLevel || "low",
        reported_by: user.id,
        source_escalation_id: sourceEscalationId || null,
        source_signal_id: sourceSignalId || null,
        system_id: systemId || null,
      })
      .select("*, ai_vendors(vendor_name)")
      .single();

    if (error) {
      console.error("[incidents] Error creating:", error);
      throw new Error("Failed to create incident");
    }

    await writeAuditLog({
      organisationId: orgId,
      entityType: "incident",
      entityId: incident.id,
      actionType: "created",
      performedBy: user.id,
      metadata: { title, impact_level: impactLevel || "low", source_escalation_id: sourceEscalationId || null },
    });

    return apiOk({ incident }, 201);
  });
}

// PATCH — update incident (status, resolution)
export async function PATCH(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { user, orgId, db } = auth;

    const parsed = await parseBody(req, updateIncidentSchema);
    if (parsed.error) return parsed.error;
    const { id, status: newStatus, resolution, impactLevel, title: newTitle, description: newDesc, aiVendorId } = parsed.data;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      edited_at: new Date().toISOString(),
      edited_by: user.id,
    };
    if (newStatus) updates.status = newStatus;
    if (resolution !== undefined) updates.resolution = resolution;
    if (impactLevel) updates.impact_level = impactLevel;
    if (newTitle !== undefined) updates.title = newTitle;
    if (newDesc !== undefined) updates.description = newDesc;
    if (aiVendorId !== undefined) updates.ai_vendor_id = aiVendorId || null;
    if (newStatus === "resolved" || newStatus === "closed") {
      updates.resolved_at = new Date().toISOString();
    }

    const { data: incident, error } = await db
      .from("incidents")
      .update(updates)
      .eq("id", id)
      .eq("organisation_id", orgId)
      .select("*, edited_at, edited_by, ai_vendors(vendor_name)")
      .single();

    if (error) {
      throw new Error("Failed to update incident");
    }

    await writeAuditLog({
      organisationId: orgId,
      entityType: "incident",
      entityId: id,
      actionType: "status_change",
      performedBy: user.id,
      metadata: { status: newStatus, impact_level: impactLevel },
    });

    return apiOk({ incident });
  });
}
