import type { PlanName } from "@/lib/entitlements";

export type VersiumTier = "Core" | "Assure" | "Verify";

export type TierInfo = {
  name: VersiumTier;
  tagline: string;
  highlights: string[];
  /** Plans that map to this tier */
  plans: PlanName[];
};

// Value-slice highlights updated as features ship. Current state (Phase 4,
// 2026-06-30): Basic Drift on Core, public Verification for anyone, non-
// chain Decision Ledger + Incident Lock on Core, chain-anchoring as the
// Verify moat. See docs/plans/2026-06-30-value-slice-pricing.md.
export const TIERS: Record<VersiumTier, TierInfo> = {
  Core: {
    name: "Core",
    tagline: "Governance Intelligence Foundation",
    highlights: [
      "TrustOrg & TrustSys assessments (2 systems)",
      "AI system registry & vendor register",
      "AI Copilot (policy generation)",
      "Basic Drift monitoring (own 2 systems)",
      "Decision Ledger (off-chain, tamper-evident)",
      "Incident Lock (off-chain, tamper-evident)",
    ],
    plans: ["explorer", "starter"],
  },
  Assure: {
    name: "Assure",
    tagline: "Continuous Alignment & Runtime Governance",
    highlights: [
      "Everything in Core, plus:",
      "Full Drift across 6 systems",
      "Escalation workflows + Runtime Signals",
      "Team management (5 users)",
      "Advanced reporting & audit timeline",
    ],
    plans: ["pro"],
  },
  Verify: {
    name: "Verify",
    tagline: "On-chain cryptographic proof",
    highlights: [
      "Everything in Assure, plus:",
      "On-chain anchored attestations",
      "On-chain anchored Incident Lock",
      "On-chain anchored Decision Ledger",
      "Human-verified approvals",
      "Provenance certificates",
      "Cross-org trust exchange",
      "API access + SSO/SAML",
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
