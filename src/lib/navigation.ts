// src/lib/navigation.ts

import type { PlanName } from "@/lib/entitlements";
import type { CapabilityKey } from "@/lib/capabilityIcons";

export type NavItem = {
  label: string;
  href: string;
  /** Icon key from the canonical capability registry (src/lib/capabilityIcons.ts). */
  icon: CapabilityKey;
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
  /** Dashboard page for this section (clicking the header navigates here) */
  href?: string;
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
    href: "/govern",
    items: [
      { label: "TrustGraph", href: "/govern/trustgraph", icon: "trustgraph", exists: true },
      { label: "Policies", href: "/govern/policies", icon: "policies", exists: true },
      { label: "AI Registry", href: "/govern/registry", icon: "ai-registry", exists: true },
      { label: "Vendors", href: "/govern/vendors", icon: "vendors", exists: true },
      { label: "Models", href: "/govern/models", icon: "models", exists: true },
      { label: "Regulation & Compliance", href: "/govern/compliance", icon: "regulation", exists: true },
      { label: "Actions", href: "/actions", icon: "actions", exists: true },
    ],
  },
  {
    id: "monitor",
    label: "MONITOR",
    minTier: "pro",
    tierBadge: "Assure",
    href: "/monitor",
    items: [
      { label: "Drift & Alerts", href: "/monitor/drift", icon: "drift-alerts", exists: true },
      { label: "Escalations", href: "/monitor/escalations", icon: "escalations", exists: true },
      { label: "Incidents", href: "/monitor/incidents", icon: "incidents", exists: true },
      { label: "Declarations", href: "/monitor/declarations", icon: "declarations", exists: true },
      { label: "Signals", href: "/monitor/signals", icon: "signals", exists: true },
    ],
  },
  {
    id: "prove",
    label: "PROVE",
    minTier: "enterprise",
    tierBadge: "Verify",
    href: "/prove",
    items: [
      { label: "Approvals", href: "/prove/approvals", icon: "approvals", exists: true },
      { label: "Attestations", href: "/prove/attestations", icon: "attestations", exists: true },
      { label: "Provenance", href: "/prove/provenance", icon: "provenance", exists: true },
      { label: "Decisions", href: "/prove/decisions", icon: "decisions", exists: true },
      { label: "Incident Lock", href: "/prove/incident-locks", icon: "incident-lock", exists: true },
      { label: "Trust Exchange", href: "/prove/exchanges", icon: "trust-exchange", exists: true },
      { label: "Verification", href: "/prove/verification", icon: "verification", exists: true },
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
      { label: "Reports", href: "/reports", icon: "reports", exists: true },
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
