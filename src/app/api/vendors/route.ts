import { requireAuth, apiError, apiOk, withErrorHandling, parseBody } from "@/lib/apiHelpers";
import { maxVendors } from "@/lib/entitlements";
import { createVendorSchema, updateVendorSchema } from "@/lib/validations";

// GET — list vendors for org
export async function GET() {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, plan, db } = auth;

    const limit = maxVendors(plan);

    const { data: vendors, error } = await db
      .from("ai_vendors")
      .select("*")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return apiError("Failed to fetch vendors", 500);

    return apiOk({
      vendors: vendors ?? [],
      limit: limit === Infinity ? -1 : limit,
      count: vendors?.length ?? 0,
    });
  });
}

// POST — add vendor
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, plan, db } = auth;

    // Check limit
    const limit = maxVendors(plan);
    const { count } = await db
      .from("ai_vendors")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", orgId);

    if ((count ?? 0) >= limit) {
      return apiError("Vendor limit reached. Upgrade your plan for more.", 403);
    }

    const parsed = await parseBody(req, createVendorSchema);
    if (parsed.error) return parsed.error;
    const { vendorName, vendorUrl, dataLocation, dataTypes, riskCategory, notes } = parsed.data;

    const { data: vendor, error } = await db
      .from("ai_vendors")
      .insert({
        organisation_id: orgId,
        vendor_name: vendorName,
        vendor_url: vendorUrl || null,
        data_location: dataLocation || null,
        data_types: dataTypes || [],
        risk_category: riskCategory || "unassessed",
        source: "manual",
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return apiError("Failed to add vendor", 500);

    return apiOk({ vendor });
  });
}

// PATCH — update vendor
export async function PATCH(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const parsed = await parseBody(req, updateVendorSchema);
    if (parsed.error) return parsed.error;
    const { id, ...updates } = parsed.data;

    // Map camelCase to snake_case for allowed fields
    const allowedUpdates: Record<string, unknown> = {};
    if (updates.vendorName !== undefined) allowedUpdates.vendor_name = updates.vendorName;
    if (updates.vendorUrl !== undefined) allowedUpdates.vendor_url = updates.vendorUrl;
    if (updates.dataLocation !== undefined) allowedUpdates.data_location = updates.dataLocation;
    if (updates.dataTypes !== undefined) allowedUpdates.data_types = updates.dataTypes;
    if (updates.riskCategory !== undefined) {
      allowedUpdates.risk_category = updates.riskCategory;
      allowedUpdates.manual_override = true;
    }
    if (updates.notes !== undefined) allowedUpdates.notes = updates.notes;
    allowedUpdates.updated_at = new Date().toISOString();

    const { data: vendor, error } = await db
      .from("ai_vendors")
      .update(allowedUpdates)
      .eq("id", id)
      .eq("organisation_id", orgId)
      .select()
      .single();

    if (error) return apiError("Failed to update vendor", 500);

    return apiOk({ vendor });
  });
}

// DELETE — remove vendor
export async function DELETE(req: Request) {
  return withErrorHandling(async () => {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { orgId, db } = auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return apiError("id is required", 400);

    const { error } = await db
      .from("ai_vendors")
      .delete()
      .eq("id", id)
      .eq("organisation_id", orgId);

    if (error) return apiError("Failed to delete vendor", 500);

    return apiOk({ deleted: true });
  });
}
