// src/lib/navigation.ts

import type { PlanName } from "@/lib/entitlements";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  /** If true, this item links to an existing page. If false, it's a new placeholder. */
  exists: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  /** Minimum plan tier required to access this section. null = available to all. */
  minTier: PlanName | null;
  /** Tier badge text shown when locked (e.g., "Assure", "Verify") */
  tierBadge?: string;
  items: NavItem[];
};

/** Ordered plan tiers from lowest to highest */
const TIER_ORDER: PlanName[] = ["explorer", "starter", "pro", "enterprise"];

/** Check if a user's plan meets the minimum tier requirement */
export function meetsMinTier(userPlan: string | null | undefined, minTier: PlanName | null): boolean {
  if (!minTier) return true;
  const userIdx = TIER_ORDER.indexOf((userPlan ?? "explorer") as PlanName);
  const minIdx = TIER_ORDER.indexOf(minTier);
  return userIdx >= minIdx;
}

/**
 * Map current plans to Verisum tiers:
 * explorer/starter → Core
 * pro → Assure
 * enterprise → Verify
 */
export function getTierName(plan: string | null | undefined): string {
  const p = plan ?? "explorer";
  if (p === "enterprise") return "Verify";
  if (p === "pro") return "Assure";
  return "Core";
}

export const navSections: NavSection[] = [
  {
    id: "overview",
    label: "",
    minTier: null,
    items: [
      { label: "Control Centre", href: "/dashboard", icon: "layout-dashboard", exists: true },
    ],
  },
  {
    id: "govern",
    label: "GOVERN",
    minTier: null,
    items: [
      { label: "TrustGraph", href: "/govern/trustgraph", icon: "git-branch", exists: true },
      { label: "Policies", href: "/copilot/generate-policy", icon: "scroll", exists: true },
      { label: "AI Registry", href: "/govern/registry", icon: "server", exists: true },
      { label: "Vendors", href: "/govern/vendors", icon: "building", exists: true },
      { label: "Models", href: "/govern/models", icon: "cpu", exists: true },
      { label: "Actions", href: "/actions", icon: "check-circle", exists: true },
    ],
  },
  {
    id: "monitor",
    label: "MONITOR",
    minTier: "pro",
    tierBadge: "Assure",
    items: [
      { label: "Drift & Alerts", href: "/monitor/drift", icon: "activity", exists: true },
      { label: "Escalations", href: "/monitor/escalations", icon: "alert-triangle", exists: true },
      { label: "Incidents", href: "/monitor/incidents", icon: "zap", exists: true },
      { label: "Declarations", href: "/monitor/declarations", icon: "user-check", exists: true },
      { label: "Signals", href: "/monitor/signals", icon: "radio", exists: true },
    ],
  },
  {
    id: "prove",
    label: "PROVE",
    minTier: "enterprise",
    tierBadge: "Verify",
    items: [
      { label: "Approvals", href: "/prove/approvals", icon: "shield-check", exists: true },
      { label: "Attestations", href: "/prove/attestations", icon: "stamp", exists: true },
      { label: "Provenance", href: "/prove/provenance", icon: "link", exists: true },
      { label: "Decisions", href: "/prove/decisions", icon: "file-text", exists: true },
      { label: "Incident Lock", href: "/prove/incident-locks", icon: "lock", exists: true },
      { label: "Trust Exchange", href: "/prove/exchanges", icon: "share", exists: true },
      { label: "Verification", href: "/prove/verification", icon: "search", exists: true },
    ],
  },
  {
    id: "developer",
    label: "DEVELOPER",
    minTier: "pro",
    tierBadge: "Assure",
    items: [
      { label: "API Keys", href: "/developer/api-keys", icon: "key", exists: true },
    ],
  },
  {
    id: "report",
    label: "REPORT",
    minTier: null,
    items: [
      { label: "Reports", href: "/reports", icon: "file-text", exists: true },
    ],
  },
  {
    id: "settings",
    label: "SETTINGS",
    minTier: null,
    items: [
      { label: "Settings", href: "/dashboard/settings", icon: "settings", exists: true },
    ],
  },
];
