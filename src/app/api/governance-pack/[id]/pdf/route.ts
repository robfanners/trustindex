import { requireAuth, apiError } from "@/lib/apiHelpers";
import { NextResponse } from "next/server";
import {
  generateGovernanceStatementPdf,
  generateUsageInventoryPdf,
  generateGapAnalysisPdf,
} from "@/lib/governancePdf";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/governance-pack/[id]/pdf?type=statement|inventory|gap
// ---------------------------------------------------------------------------

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // ---- Auth ----
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const { db } = auth;

    // ---- Profile + company name ----
    const { data: profile } = await db
      .from("profiles")
      .select("company_name")
      .eq("id", auth.user.id)
      .single();

    const orgName = profile?.company_name || "Organisation";

    // ---- Load pack ----
    const { data: pack, error: packErr } = await db
      .from("governance_packs")
      .select("*")
      .eq("id", id)
      .eq("organisation_id", auth.orgId)
      .single();

    if (packErr || !pack) {
      return apiError("Governance pack not found", 404);
    }

    if (pack.status !== "ready") {
      return apiError("Pack is not ready for download", 400);
    }

    // ---- Determine document type ----
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!type || !["statement", "inventory", "gap"].includes(type)) {
      return apiError("Invalid type. Must be one of: statement, inventory, gap", 400);
    }

    let pdfBytes: Uint8Array;
    let filename: string;
    const version: number = pack.version ?? 1;

    switch (type) {
      case "statement":
        pdfBytes = generateGovernanceStatementPdf(
          pack.statement_md ?? "",
          orgName,
          version,
        );
        filename = `governance-statement-v${version}.pdf`;
        break;

      case "inventory":
        pdfBytes = generateUsageInventoryPdf(
          pack.inventory_json ?? { company: {}, tools: [], additionalVendors: [] },
          orgName,
          version,
        );
        filename = `ai-usage-inventory-v${version}.pdf`;
        break;

      case "gap":
        pdfBytes = generateGapAnalysisPdf(
          pack.gap_md ?? "",
          orgName,
          version,
        );
        filename = `risk-gap-summary-v${version}.pdf`;
        break;

      default:
        return apiError("Invalid type", 400);
    }

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return apiError(message, 500);
  }
}
