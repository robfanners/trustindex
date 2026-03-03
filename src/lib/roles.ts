// src/lib/roles.ts

/**
 * Verisum role definitions and role-to-navigation mapping.
 *
 * Extends the original TrustGraphRole set with three new roles:
 * board_viewer, signatory, auditor. Each role maps to a set of
 * visible nav section IDs (from navigation.ts).
 */

export type VersiumRole =
  | "owner"
  | "admin"
  | "risk"
  | "operator"
  | "exec"
  | "board_viewer"
  | "signatory"
  | "auditor";

export type RoleInfo = {
  label: string;
  description: string;
  /** Nav section IDs this role can see (from navSections in navigation.ts) */
  visibleSections: string[];
  /** If true, the user can view but not create/edit/delete */
  readOnly: boolean;
};

const ALL_SECTIONS = ["overview", "govern", "monitor", "prove", "report", "settings"];

export const ROLES: Record<VersiumRole, RoleInfo> = {
  owner: {
    label: "Owner",
    description: "Full access to all settings and data",
    visibleSections: ALL_SECTIONS,
    readOnly: false,
  },
  admin: {
    label: "Admin",
    description: "Full access to all features and settings",
    visibleSections: ALL_SECTIONS,
    readOnly: false,
  },
  risk: {
    label: "Risk Officer",
    description: "Governance, monitoring, and reporting",
    visibleSections: ["overview", "govern", "monitor", "report", "settings"],
    readOnly: false,
  },
  operator: {
    label: "Engineer / Assessor",
    description: "Assessments, actions, and reporting",
    visibleSections: ["overview", "govern", "report"],
    readOnly: false,
  },
  exec: {
    label: "Executive",
    description: "Governance, monitoring, and reporting",
    visibleSections: ["overview", "govern", "monitor", "report"],
    readOnly: false,
  },
  board_viewer: {
    label: "Board Viewer",
    description: "Overview, reports, and proof verification (read-only)",
    visibleSections: ["overview", "report", "prove"],
    readOnly: true,
  },
  signatory: {
    label: "Signatory",
    description: "Approval inbox and proof verification only",
    visibleSections: ["overview", "prove"],
    readOnly: false,
  },
  auditor: {
    label: "Auditor",
    description: "Full visibility across all sections (read-only)",
    visibleSections: ALL_SECTIONS,
    readOnly: true,
  },
};

/** Get the role info for a given role string. Defaults to "owner" for unknown roles. */
export function getRoleInfo(role: string | null | undefined): RoleInfo {
  const r = (role ?? "owner") as VersiumRole;
  return ROLES[r] ?? ROLES.operator;
}

/** Check if a role can see a given nav section ID */
export function canSeeSection(role: string | null | undefined, sectionId: string): boolean {
  return getRoleInfo(role).visibleSections.includes(sectionId);
}

/** Get ordered list of role options for dropdowns */
export function getRoleOptions(): { value: VersiumRole; label: string; description: string }[] {
  return (Object.entries(ROLES) as [VersiumRole, RoleInfo][]).map(([value, info]) => ({
    value,
    label: info.label,
    description: info.description,
  }));
}
