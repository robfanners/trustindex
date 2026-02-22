// ---------------------------------------------------------------------------
// VCC — Role types, permission matrix, check helpers
// ---------------------------------------------------------------------------
// Pure functions — safe for both client and server use.
// ---------------------------------------------------------------------------

export type AdminRole =
  | "SUPER_ADMIN"
  | "ORG_SUPPORT"
  | "BILLING_ADMIN"
  | "ANALYTICS_VIEWER";

export type VCCPermission =
  | "view_dashboard"
  | "view_org_details"
  | "view_aggregated_metrics"
  | "change_plans"
  | "suspend_reinstate"
  | "override_limits"
  | "recalculate_scores"
  | "reset_tokens"
  | "close_surveys"
  | "view_system_runs"
  | "flag_risk"
  | "archive_systems"
  | "manage_roles"
  | "view_audit_log"
  | "apply_credits";

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Check helpers
// ---------------------------------------------------------------------------

/** Check if any of the user's roles grant the required permission */
export function hasPermission(
  roles: AdminRole[],
  permission: VCCPermission
): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.has(permission) ?? false);
}

/** Check multiple permissions (all must be satisfied) */
export function hasAllPermissions(
  roles: AdminRole[],
  permissions: VCCPermission[]
): boolean {
  return permissions.every((p) => hasPermission(roles, p));
}

/** Get the highest-priority role for display purposes */
export function primaryRole(roles: AdminRole[]): AdminRole {
  const priority: AdminRole[] = [
    "SUPER_ADMIN",
    "ORG_SUPPORT",
    "BILLING_ADMIN",
    "ANALYTICS_VIEWER",
  ];
  for (const r of priority) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
}

/** Human-readable label for a role */
export function roleLabel(role: AdminRole): string {
  const labels: Record<AdminRole, string> = {
    SUPER_ADMIN: "Super Admin",
    ORG_SUPPORT: "Org Support",
    BILLING_ADMIN: "Billing Admin",
    ANALYTICS_VIEWER: "Analytics Viewer",
  };
  return labels[role] ?? role;
}
