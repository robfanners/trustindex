"use client";

import { useAuth } from "@/context/AuthContext";
import { canAccessReport } from "@/lib/reportAuth";
import type { ReportType } from "@/lib/reportAuth";

type RoleGateProps = {
  children: React.ReactNode;
  report: ReportType;
  fallback?: React.ReactNode;
};

/**
 * Conditionally renders children if the authenticated user's role
 * has permission for the given report type.
 */
export default function RoleGate({ children, report, fallback }: RoleGateProps) {
  const { profile } = useAuth();
  const role = profile?.role ?? null;

  if (!canAccessReport(role, report)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
