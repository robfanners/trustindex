import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedOrgWithRole } from "@/lib/reportAuth.server";
import { canAccessReport } from "@/lib/reportAuth";
import type { TrustGraphRole } from "@/lib/reportAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// GET /api/reports/action-analytics — action stats + time-series
// ---------------------------------------------------------------------------
// Query params: from, to (ISO date), severity, status, run_type

export async function GET(req: NextRequest) {
  try {
    const result = await getAuthenticatedOrgWithRole();
    if ("error" in result) return result.error;

    const { orgId, role } = result;

    if (!canAccessReport(role as TrustGraphRole, "action_completion")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const db = supabaseServer();
    const url = req.nextUrl;

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const severity = url.searchParams.get("severity");
    const status = url.searchParams.get("status");
    const runType = url.searchParams.get("run_type");

    if (!from || !to) {
      return NextResponse.json(
        { error: "from and to date params are required" },
        { status: 400 }
      );
    }

    // Fetch all actions in range
    let query = db
      .from("actions")
      .select("id, status, severity, due_date, owner_id, linked_run_type, created_at, updated_at")
      .eq("organisation_id", orgId)
      .gte("created_at", from)
      .lte("created_at", to);

    if (severity && ["critical", "high", "medium", "low"].includes(severity)) {
      query = query.eq("severity", severity);
    }
    if (
      status &&
      ["open", "in_progress", "blocked", "done"].includes(status)
    ) {
      query = query.eq("status", status);
    }
    if (runType && ["org", "sys"].includes(runType)) {
      query = query.eq("linked_run_type", runType);
    }

    const { data: actions, error: fetchErr } = await query;

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    type ActionRow = {
      id: string;
      status: string;
      severity: string;
      due_date: string | null;
      owner_id: string | null;
      linked_run_type: string | null;
      created_at: string;
      updated_at: string;
    };

    const list: ActionRow[] = actions || [];
    const now = new Date();

    // --- Totals ---
    const doneActions = list.filter((a) => a.status === "done");
    let avgDaysToClose = 0;
    if (doneActions.length > 0) {
      const totalDays = doneActions.reduce((sum, a) => {
        const created = new Date(a.created_at).getTime();
        const closed = new Date(a.updated_at).getTime();
        return sum + (closed - created) / 86400000;
      }, 0);
      avgDaysToClose = Math.round((totalDays / doneActions.length) * 10) / 10;
    }

    const totals = {
      total: list.length,
      open: list.filter((a) => a.status === "open").length,
      in_progress: list.filter((a) => a.status === "in_progress").length,
      blocked: list.filter((a) => a.status === "blocked").length,
      done: doneActions.length,
      overdue: list.filter(
        (a) => a.due_date && new Date(a.due_date) < now && a.status !== "done"
      ).length,
      unassigned: list.filter((a) => !a.owner_id).length,
      avg_days_to_close: avgDaysToClose,
    };

    // --- By severity ---
    const bySeverity: Record<
      string,
      { total: number; open: number; done: number }
    > = {};
    for (const sev of ["critical", "high", "medium", "low"]) {
      const subset = list.filter((a) => a.severity === sev);
      bySeverity[sev] = {
        total: subset.length,
        open: subset.filter((a) => a.status !== "done").length,
        done: subset.filter((a) => a.status === "done").length,
      };
    }

    // --- Weekly time-series ---
    const weekMap = new Map<string, { created: number; resolved: number }>();

    for (const a of list) {
      const week = getISOWeek(new Date(a.created_at));
      const entry = weekMap.get(week) || { created: 0, resolved: 0 };
      entry.created++;
      weekMap.set(week, entry);
    }

    for (const a of doneActions) {
      const week = getISOWeek(new Date(a.updated_at));
      const entry = weekMap.get(week) || { created: 0, resolved: 0 };
      entry.resolved++;
      weekMap.set(week, entry);
    }

    const timeSeries = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({ week, ...data }));

    return NextResponse.json({
      analytics: {
        totals,
        by_severity: bySeverity,
        time_series: timeSeries,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helper: ISO week string e.g. "2026-W09"
// ---------------------------------------------------------------------------

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
