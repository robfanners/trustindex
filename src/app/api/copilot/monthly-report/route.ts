import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getReportLevel } from "@/lib/entitlements";
import { sendEmail } from "@/lib/email";
import { monthlyReportEmail } from "@/lib/emailTemplates";
import { jsPDF } from "jspdf";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Auth — cron bearer token
// ---------------------------------------------------------------------------

function isAuthorised(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Report data types
// ---------------------------------------------------------------------------

type ReportData = {
  orgName: string;
  reportMonth: string;
  vendors: { total: number; byRisk: Record<string, number> };
  incidents: { total: number; bySeverity: Record<string, number>; openCount: number };
  declarations: { total: number };
  governancePack: { version: number; status: string; generatedAt: string } | null;
};

type PdfReportInput = {
  orgName: string;
  plan: string;
  reportLevel: "basic" | "full";
  reportMonth: string;
  vendors: Array<{ id: string; vendor_name: string; risk_category: string }>;
  incidents: Array<{ id: string; impact_level: string; status: string }>;
  declarations: Array<{ id: string }>;
  healthScore: number | null;
};

// ---------------------------------------------------------------------------
// GET /api/copilot/monthly-report — triggered by cron on the 1st of each month
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseServer();
  const errors: string[] = [];
  let processed = 0;
  let sent = 0;

  try {
    // -----------------------------------------------------------------------
    // 1. Compute previous-month boundaries
    // -----------------------------------------------------------------------
    const now = new Date();
    const reportMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const startISO = startOfPrevMonth.toISOString();
    const endISO = endOfPrevMonth.toISOString();

    // -----------------------------------------------------------------------
    // 2. Find all orgs with paid plans
    // -----------------------------------------------------------------------
    const { data: paidProfiles } = await sb
      .from("profiles")
      .select("organisation_id, plan, email, company_name")
      .in("plan", ["starter", "pro", "enterprise"])
      .not("organisation_id", "is", null);

    if (!paidProfiles || paidProfiles.length === 0) {
      return NextResponse.json({ processed: 0, sent: 0, errors: [] });
    }

    // -----------------------------------------------------------------------
    // 3. Deduplicate by org_id — take first profile per org as "owner"
    // -----------------------------------------------------------------------
    const orgOwners = new Map<
      string,
      { plan: string; email: string; companyName: string | null }
    >();

    for (const p of paidProfiles) {
      if (p.organisation_id && !orgOwners.has(p.organisation_id)) {
        orgOwners.set(p.organisation_id, {
          plan: p.plan,
          email: p.email,
          companyName: p.company_name,
        });
      }
    }

    // -----------------------------------------------------------------------
    // 4. Process each org
    // -----------------------------------------------------------------------
    for (const [orgId, owner] of orgOwners) {
      const reportLevel = getReportLevel(owner.plan);
      if (reportLevel === "none") continue;

      try {
        // --- Fetch org name ---
        const { data: org } = await sb
          .from("organisations")
          .select("name")
          .eq("id", orgId)
          .single();

        const orgName = org?.name ?? owner.companyName ?? "Organisation";

        // --- Aggregate data in parallel ---
        const [vendorRes, incidentRes, declarationRes, packRes, healthRes] =
          await Promise.all([
            // Vendors: all for this org
            sb
              .from("ai_vendors")
              .select("id, vendor_name, risk_category")
              .eq("organisation_id", orgId),

            // Incidents: only this month
            sb
              .from("incidents")
              .select("id, impact_level, status")
              .eq("organisation_id", orgId)
              .gte("created_at", startISO)
              .lte("created_at", endISO),

            // Declarations: total for this org
            sb
              .from("staff_declarations")
              .select("id")
              .eq("organisation_id", orgId),

            // Latest governance pack
            sb
              .from("governance_packs")
              .select("version, status, generated_at")
              .eq("organisation_id", orgId)
              .order("version", { ascending: false })
              .limit(1)
              .maybeSingle(),

            // Health score
            sb
              .from("trustgraph_health_mv")
              .select("*")
              .eq("organisation_id", orgId)
              .maybeSingle(),
          ]);

        const vendors = vendorRes.data ?? [];
        const incidents = incidentRes.data ?? [];
        const declarations = declarationRes.data ?? [];
        const latestPack = packRes.data;
        const health = healthRes.data;

        // --- Build risk breakdown ---
        const byRisk: Record<string, number> = {};
        for (const v of vendors) {
          const risk = v.risk_category || "unassessed";
          byRisk[risk] = (byRisk[risk] || 0) + 1;
        }

        // --- Build severity breakdown + open count ---
        const bySeverity: Record<string, number> = {};
        let openCount = 0;
        for (const inc of incidents) {
          bySeverity[inc.impact_level] = (bySeverity[inc.impact_level] || 0) + 1;
          if (inc.status === "open" || inc.status === "investigating") {
            openCount++;
          }
        }

        // --- Compose report data ---
        const reportData: ReportData = {
          orgName,
          reportMonth,
          vendors: { total: vendors.length, byRisk },
          incidents: { total: incidents.length, bySeverity, openCount },
          declarations: { total: declarations.length },
          governancePack: latestPack
            ? {
                version: latestPack.version,
                status: latestPack.status,
                generatedAt: latestPack.generated_at ?? "",
              }
            : null,
        };

        // -----------------------------------------------------------------
        // 5. Generate PDF + upload to Supabase Storage
        // -----------------------------------------------------------------
        const pdfBytes = generateReportPdf({
          orgName,
          plan: owner.plan,
          reportLevel,
          reportMonth,
          vendors,
          incidents,
          declarations,
          healthScore: health?.health_score ?? null,
        });

        const fileName = `reports/${orgId}/${reportMonth}-compliance-report.pdf`;

        await sb.storage.from("compliance-reports").upload(fileName, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });

        // -----------------------------------------------------------------
        // 6. Upsert into monthly_reports table
        // -----------------------------------------------------------------
        const { error: upsertErr } = await sb.from("monthly_reports").upsert(
          {
            organisation_id: orgId,
            report_month: reportMonth,
            report_data: reportData,
          },
          { onConflict: "organisation_id,report_month" }
        );

        if (upsertErr) {
          console.error(
            `[monthly-report] Upsert error for org ${orgId}:`,
            upsertErr
          );
          errors.push(`${orgId}: upsert failed — ${upsertErr.message}`);
          processed++;
          continue;
        }

        // -----------------------------------------------------------------
        // 7. Send email via Resend
        // -----------------------------------------------------------------
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
        const reportUrl = `${siteUrl}/dashboard#copilot`;

        const emailContent = monthlyReportEmail({
          orgName,
          month: reportMonth,
          healthScore: health?.health_score ?? null,
          incidentCount: incidents.length,
          vendorCount: vendors.length,
          declarationCount: declarations.length,
          reportUrl,
        });

        let emailSent = false;
        try {
          const result = await sendEmail({
            to: owner.email,
            subject: emailContent.subject,
            html: emailContent.html,
          });
          emailSent = !!result;
        } catch (emailErr: unknown) {
          console.error(
            `[monthly-report] Email failed for ${orgId}:`,
            emailErr
          );
          errors.push(
            `${orgId}: email failed — ${emailErr instanceof Error ? emailErr.message : "unknown"}`
          );
        }

        // -----------------------------------------------------------------
        // 8. Update sent_at if email was sent
        // -----------------------------------------------------------------
        if (emailSent) {
          await sb
            .from("monthly_reports")
            .update({ sent_at: new Date().toISOString() })
            .eq("organisation_id", orgId)
            .eq("report_month", reportMonth);

          sent++;
        }

        processed++;
      } catch (orgErr: unknown) {
        console.error(`[monthly-report] Error for org ${orgId}:`, orgErr);
        errors.push(
          `${orgId}: ${orgErr instanceof Error ? orgErr.message : "unknown error"}`
        );
        processed++;
      }
    }

    return NextResponse.json({ processed, sent, errors });
  } catch (err: unknown) {
    console.error("[monthly-report] Fatal error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Internal server error",
        processed,
        sent,
        errors,
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PDF generation (server-side, no DOM needed)
// ---------------------------------------------------------------------------

function generateReportPdf(data: PdfReportInput): Uint8Array {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Format month label from YYYY-MM
  const [yearStr, monthStr] = data.reportMonth.split("-");
  const monthDate = new Date(Number(yearStr), Number(monthStr) - 1);
  const monthLabel = monthDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

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
  doc.text(`Report period: ${monthLabel}`, margin, y);
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

  if (data.healthScore !== null) {
    doc.text(
      `Verisum Health Score: ${data.healthScore.toFixed(1)} / 100`,
      margin,
      y
    );
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
      doc.text(
        `  ${risk}: ${count} vendor${count !== 1 ? "s" : ""}`,
        margin,
        y
      );
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
  doc.text(
    `Total declarations submitted: ${data.declarations.length}`,
    margin,
    y
  );
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
