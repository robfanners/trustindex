"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { AdminRole, VCCPermission } from "@/lib/vcc/permissions";

type VCCAuthContextValue = {
  adminRoles: AdminRole[];
  adminEmail: string | null;
  isAdmin: boolean;
  loading: boolean;
  hasPermission: (permission: VCCPermission) => boolean;
};

const VCCAuthContext = createContext<VCCAuthContextValue>({
  adminRoles: [],
  adminEmail: null,
  isAdmin: false,
  loading: true,
  hasPermission: () => false,
});

// Client-side permission check (mirrors server-side ROLE_PERMISSIONS)
const ROLE_PERMISSIONS: Record<AdminRole, Set<VCCPermission>> = {
  SUPER_ADMIN: new Set<VCCPermission>([
    "view_dashboard",
    "view_org_details",
    "view_aggregated_metrics",
    "change_plans",
    "suspend_reinstate",
    "override_limits",
    "recalculate_scores",
    "reset_tokens",
    "close_surveys",
    "view_system_runs",
    "flag_risk",
    "archive_systems",
    "manage_roles",
    "view_audit_log",
    "apply_credits",
  ]),
  ORG_SUPPORT: new Set<VCCPermission>([
    "view_dashboard",
    "view_org_details",
    "view_aggregated_metrics",
    "recalculate_scores",
    "reset_tokens",
    "close_surveys",
    "view_system_runs",
    "flag_risk",
    "archive_systems",
    "view_audit_log",
  ]),
  BILLING_ADMIN: new Set<VCCPermission>([
    "view_dashboard",
    "view_aggregated_metrics",
    "change_plans",
    "suspend_reinstate",
    "override_limits",
    "view_audit_log",
    "apply_credits",
  ]),
  ANALYTICS_VIEWER: new Set<VCCPermission>([
    "view_dashboard",
    "view_aggregated_metrics",
    "view_audit_log",
  ]),
};

function clientHasPermission(
  roles: AdminRole[],
  permission: VCCPermission
): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.has(permission) ?? false);
}

export function VCCAuthProvider({ children }: { children: ReactNode }) {
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAdminIdentity() {
      try {
        const res = await fetch("/api/verisum-admin/me");
        if (!res.ok) {
          setIsAdmin(false);
          setAdminRoles([]);
          setAdminEmail(null);
          return;
        }
        const { data } = await res.json();
        if (!cancelled && data) {
          setAdminRoles(data.roles ?? []);
          setAdminEmail(data.email ?? null);
          setIsAdmin(true);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
          setAdminRoles([]);
          setAdminEmail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAdminIdentity();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasPermission = useCallback(
    (permission: VCCPermission) => clientHasPermission(adminRoles, permission),
    [adminRoles]
  );

  return (
    <VCCAuthContext.Provider
      value={{ adminRoles, adminEmail, isAdmin, loading, hasPermission }}
    >
      {children}
    </VCCAuthContext.Provider>
  );
}

export function useVCCAuth() {
  return useContext(VCCAuthContext);
}
