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
  /**
   * Value-slice per-item gating (2026-06-30). When set, this item locks
   * independently of the parent section's minTier — enabling per-feature
   * upgrade prompts rather than whole-section paywalls. Falls back to the
   * section's minTier when unset (backwards compatible).
   *
   * See docs/plans/2026-06-30-value-slice-pricing.md.
   */
  minTier?: PlanName | null;
  /**
   * Tier badge text shown next to this item when locked. Overrides the
   * section-level tierBadge. Only used when this item's minTier is set.
   */
  tierBadge?: string;
  /**
   * Reserved for future advanced feature-gating (e.g., items behind an
   * entitlement flag that isn't purely tier-based, like chain-anchoring).
   * Unused in Phase 1; wired in later phases.
   */
  featureKey?: string;
};

export type NavSection = {
  id: string;
  label: string;
  /**
   * Minimum plan tier required to access this section — applied to any
   * item that doesn't set its own minTier. null = available to all.
   *
   * Value-slice roadmap: as items migrate to per-item minTier, section
   * minTier will approach null across the board. Kept for backwards
   * compatibility during the migration.
   */
  minTier: PlanName | null;
  /** Tier badge text shown when locked (e.g., "Assure", "Verify") */
  tierBadge?: string;
  /** Dashboard page for this section (clicking the header navigates here) */
  href?: string;
  items: NavItem[];
};

/**
 * Resolve the effective minTier for a nav item, falling back to the parent
 * section's minTier when the item doesn't set its own. Enables value-slice
 * per-item gating without breaking sections that still gate as a bundle.
 */
export function getItemMinTier(item: NavItem, section: NavSection): PlanName | null {
  return item.minTier !== undefined ? item.minTier : section.minTier;
}

/**
 * Resolve the effective tier badge for a nav item, falling back to the
 * parent section's badge when the item doesn't set its own.
 */
export function getItemTierBadge(item: NavItem, section: NavSection): string | undefined {
  return item.tierBadge ?? section.tierBadge;
}

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
      // Value-slice Phase 2: Basic Drift ships to Core (2 systems, read-only).
      // Per-item override — despite section requiring Pro (Assure), this
      // specific item is accessible from Starter (Core) upwards.
      {
        label: "Drift & Alerts",
        href: "/monitor/drift",
        icon: "drift-alerts",
        exists: true,
        minTier: "starter",
      },
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
