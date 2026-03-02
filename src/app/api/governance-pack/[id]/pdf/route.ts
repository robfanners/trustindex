import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-auth-server";
import { supabaseServer } from "@/lib/supabaseServer";
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
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = supabaseServer();

    // ---- Profile + org ----
    const { data: profile } = await db
      .from("profiles")
      .select("organisation_id, company_name")
      .eq("id", user.id)
      .single();

    if (!profile?.organisation_id) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const orgName = profile.company_name || "Organisation";

    // ---- Load pack ----
    const { data: pack, error: packErr } = await db
      .from("governance_packs")
      .select("*")
      .eq("id", id)
      .eq("organisation_id", profile.organisation_id)
      .single();

    if (packErr || !pack) {
      return NextResponse.json(
        { error: "Governance pack not found" },
        { status: 404 },
      );
    }

    if (pack.status !== "ready") {
      return NextResponse.json(
        { error: "Pack is not ready for download" },
        { status: 400 },
      );
    }

    // ---- Determine document type ----
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!type || !["statement", "inventory", "gap"].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be one of: statement, inventory, gap' },
        { status: 400 },
      );
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
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
