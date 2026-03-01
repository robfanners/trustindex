import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getReportLevel } from "@/lib/entitlements";
import { jsPDF } from "jspdf";

export const runtime = "nodejs";
export const maxDuration = 60;

// Protect cron route with CRON_SECRET
function isAuthorised(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  // Also allow manual trigger from authenticated admin (checked separately)
  return false;
}

export async function GET(req: Request) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseServer();
  const results: Array<{ orgId: string; orgName: string; status: string }> = [];

  try {
    // Find all orgs with paid plans (starter, pro, enterprise)
    const { data: paidProfiles } = await sb
      .from("profiles")
      .select("organisation_id, plan")
      .in("plan", ["starter", "pro", "enterprise"])
      .not("organisation_id", "is", null);

    if (!paidProfiles || paidProfiles.length === 0) {
      return NextResponse.json({ message: "No paid orgs to report on", count: 0 });
    }

    // Deduplicate by org (multiple users per org)
    const orgMap = new Map<string, string>();
    for (const p of paidProfiles) {
      if (p.organisation_id && !orgMap.has(p.organisation_id)) {
        orgMap.set(p.organisation_id, p.plan);
      }
    }

    for (const [orgId, plan] of orgMap) {
      const reportLevel = getReportLevel(plan);
      if (reportLevel === "none") continue;

      try {
        // Fetch org name
        const { data: org } = await sb
          .from("organisations")
          .select("name")
          .eq("id", orgId)
          .single();

        const orgName = org?.name ?? "Organisation";

        // Fetch data for report
        const [vendorRes, incidentRes, declarationRes, healthRes] = await Promise.all([
          sb.from("ai_vendors").select("id, vendor_name, risk_category").eq("organisation_id", orgId),
          sb.from("incidents").select("id, impact_level, status").eq("organisation_id", orgId),
          sb.from("staff_declarations").select("id").eq("organisation_id", orgId),
          sb.from("trustgraph_health_mv").select("*").eq("organisation_id", orgId).maybeSingle(),
        ]);

        const vendors = vendorRes.data ?? [];
        const incidents = incidentRes.data ?? [];
        const declarations = declarationRes.data ?? [];
        const health = healthRes.data;

        // Generate PDF
        const pdfBytes = generateReportPdf({
          orgName,
          plan,
          reportLevel,
          vendors,
          incidents,
          declarations,
          healthScore: health?.health_score ?? null,
        });

        // Store in Supabase storage
        const month = new Date().toISOString().slice(0, 7); // YYYY-MM
        const fileName = `reports/${orgId}/${month}-compliance-report.pdf`;

        const { error: uploadErr } = await sb.storage
          .from("compliance-reports")
          .upload(fileName, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadErr) {
          console.error(`[monthly-report] Upload error for ${orgId}:`, uploadErr);
          results.push({ orgId, orgName, status: "upload_failed" });
        } else {
          results.push({ orgId, orgName, status: "generated" });
        }
      } catch (orgErr) {
        console.error(`[monthly-report] Error for org ${orgId}:`, orgErr);
        results.push({ orgId, orgName: orgId, status: "error" });
      }
    }

    return NextResponse.json({
      message: `Generated ${results.filter((r) => r.status === "generated").length} reports`,
      count: results.length,
      results,
    });
  } catch (err: any) {
    console.error("[monthly-report] Fatal error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PDF generation (server-side, no DOM needed)
// ---------------------------------------------------------------------------

type ReportData = {
  orgName: string;
  plan: string;
  reportLevel: "basic" | "full";
  vendors: Array<{ id: string; vendor_name: string; risk_category: string }>;
  incidents: Array<{ id: string; impact_level: string; status: string }>;
  declarations: Array<{ id: string }>;
  healthScore: number | null;
};

function generateReportPdf(data: ReportData): Uint8Array {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // --- Header ---
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("AI Governance Compliance Report", margin, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(data.orgName, margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Report period: ${month}`, margin, y);
  y += 5;
  doc.text(
    `Plan: ${data.plan.charAt(0).toUpperCase() + data.plan.slice(1)} | Report level: ${data.reportLevel}`,
    margin,
    y
  );
  y += 10;
  doc.setTextColor(0);

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 8;

  // --- Executive Summary ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Executive Summary", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Health score
  if (data.healthScore !== null) {
    doc.text(`TrustGraph Health Score: ${data.healthScore.toFixed(1)} / 100`, margin, y);
    y += 6;
  }

  doc.text(`AI Vendors tracked: ${data.vendors.length}`, margin, y);
  y += 6;
  doc.text(`Staff declarations received: ${data.declarations.length}`, margin, y);
  y += 6;
  doc.text(`Incidents logged: ${data.incidents.length}`, margin, y);
  y += 10;

  // --- Vendor Summary ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("AI Vendor Register", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  if (data.vendors.length === 0) {
    doc.text("No AI vendors registered.", margin, y);
    y += 6;
  } else {
    const riskCounts: Record<string, number> = {};
    for (const v of data.vendors) {
      const risk = v.risk_category || "unassessed";
      riskCounts[risk] = (riskCounts[risk] || 0) + 1;
    }
    for (const [risk, count] of Object.entries(riskCounts)) {
      doc.text(`  ${risk}: ${count} vendor${count !== 1 ? "s" : ""}`, margin, y);
      y += 5;
    }
    y += 3;

    // Full report: list vendors
    if (data.reportLevel === "full") {
      for (const v of data.vendors.slice(0, 20)) {
        doc.text(`  - ${v.vendor_name} (${v.risk_category})`, margin + 2, y);
        y += 5;
        if (y > 270) {
          doc.addPage();
          y = margin;
        }
      }
      y += 3;
    }
  }

  // --- Incident Summary ---
  if (y > 250) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Incident Summary", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  if (data.incidents.length === 0) {
    doc.text("No incidents logged this period.", margin, y);
    y += 6;
  } else {
    const impactCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    for (const inc of data.incidents) {
      impactCounts[inc.impact_level] = (impactCounts[inc.impact_level] || 0) + 1;
      statusCounts[inc.status] = (statusCounts[inc.status] || 0) + 1;
    }

    doc.text("By impact level:", margin, y);
    y += 5;
    for (const [level, count] of Object.entries(impactCounts)) {
      doc.text(`  ${level}: ${count}`, margin + 2, y);
      y += 5;
    }
    y += 3;

    doc.text("By status:", margin, y);
    y += 5;
    for (const [status, count] of Object.entries(statusCounts)) {
      doc.text(`  ${status}: ${count}`, margin + 2, y);
      y += 5;
    }
    y += 3;
  }

  // --- Declaration Compliance ---
  if (y > 250) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Staff Declaration Compliance", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total declarations submitted: ${data.declarations.length}`, margin, y);
  y += 10;

  // --- Footer ---
  if (y > 260) {
    doc.addPage();
    y = margin;
  }

  doc.setDrawColor(200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Generated by Verisum AI Governance Copilot | ${new Date().toISOString().slice(0, 10)}`,
    margin,
    y
  );
  y += 4;
  doc.text("https://verisum.org", margin, y);

  return doc.output("arraybuffer") as unknown as Uint8Array;
}
