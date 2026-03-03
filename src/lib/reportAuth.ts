// ---------------------------------------------------------------------------
// Verisum role types & report permission matrix
// ---------------------------------------------------------------------------
// This file is client-safe — no server-only imports.
// Server-side auth helper lives in reportAuth.server.ts.

import type { VersiumRole } from "@/lib/roles";

export type ReportType =
  | "board_summary"
  | "assessment_history"
  | "action_completion"
  | "risk_escalation"
  | "full_audit";

const REPORT_ACCESS: Record<ReportType, VersiumRole[]> = {
  board_summary: ["owner", "exec", "operator", "risk", "admin"],
  assessment_history: ["owner", "risk", "admin"],
  action_completion: ["owner", "operator", "risk", "admin"],
  risk_escalation: ["owner", "risk", "admin"],
  full_audit: ["owner", "risk", "admin"],
};

export function canAccessReport(
  role: VersiumRole | string | null,
  report: ReportType
): boolean {
  if (!role) return false;
  return REPORT_ACCESS[report]?.includes(role as VersiumRole) ?? false;
}

/** All report types a given role is permitted to view */
export function accessibleReports(
  role: VersiumRole | string | null
): ReportType[] {
  if (!role) return [];
  return (Object.keys(REPORT_ACCESS) as ReportType[]).filter((r) =>
    REPORT_ACCESS[r].includes(role as VersiumRole)
  );
}
