import type { PlanName } from "@/lib/entitlements";

export type VersiumTier = "Core" | "Assure" | "Verify";

export type TierInfo = {
  name: VersiumTier;
  tagline: string;
  highlights: string[];
  /** Plans that map to this tier */
  plans: PlanName[];
};

// TODO(value-slice): Continue updating highlights per tier as features
// ship. Current state as of Phase 2 (2026-06-30) — Basic Drift on Core is
// live. Phase 3 will add Verification for Explorer. Phase 4 will add non-
// chain Ledger + Incident Lock for Core. See docs/plans/2026-06-30-value-
// slice-pricing.md.
export const TIERS: Record<VersiumTier, TierInfo> = {
  Core: {
    name: "Core",
    tagline: "Governance Intelligence Foundation",
    highlights: [
      "TrustOrg & TrustSys assessments (2 systems)",
      "Governance health scoring",
      "AI system registry & vendor register",
      "Gap prioritisation & actions",
      "AI Copilot (policy generation)",
      "Basic Drift monitoring (own 2 systems)",
    ],
    plans: ["explorer", "starter"],
  },
  Assure: {
    name: "Assure",
    tagline: "Continuous Alignment & Runtime Governance",
    highlights: [
      "Everything in Core, plus:",
      "Full Drift across 6 systems",
      "Escalation workflows",
      "Runtime Signals monitoring",
      "Incident capture & declarations",
      "Team management (5 users)",
      "Advanced reporting & audit timeline",
    ],
    plans: ["pro"],
  },
  Verify: {
    name: "Verify",
    tagline: "Cryptographic Proof & Trust Portability",
    highlights: [
      "Everything in Assure, plus:",
      "Human-verified approvals",
      "Governance attestations",
      "Provenance certificates",
      "Incident lock & forensic freeze",
      "Cross-org trust exchange",
      "On-chain anchoring",
    ],
    plans: ["enterprise"],
  },
};

/** Get the VersiumTier for a given plan */
export function planToTier(plan: string | null | undefined): VersiumTier {
  const p = (plan ?? "explorer") as PlanName;
  if (TIERS.Verify.plans.includes(p)) return "Verify";
  if (TIERS.Assure.plans.includes(p)) return "Assure";
  return "Core";
}

/** Get the TierInfo for a given plan */
export function getTierInfo(plan: string | null | undefined): TierInfo {
  return TIERS[planToTier(plan)];
}

/** Check if user's plan is at or above a required tier */
export function hasTierAccess(userPlan: string | null | undefined, requiredTier: VersiumTier): boolean {
  const tierOrder: VersiumTier[] = ["Core", "Assure", "Verify"];
  const userIdx = tierOrder.indexOf(planToTier(userPlan));
  const reqIdx = tierOrder.indexOf(requiredTier);
  return userIdx >= reqIdx;
}
