import type { PlanName } from "@/lib/entitlements";

export type VersiumTier = "Core" | "Assure" | "Verify";

export type TierInfo = {
  name: VersiumTier;
  tagline: string;
  highlights: string[];
  /** Plans that map to this tier */
  plans: PlanName[];
};

export const TIERS: Record<VersiumTier, TierInfo> = {
  Core: {
    name: "Core",
    tagline: "Governance Intelligence Foundation",
    highlights: [
      "TrustOrg & TrustSys assessments",
      "Governance health scoring",
      "AI system registry & vendor register",
      "Gap prioritisation & actions",
      "Board-ready reports",
      "AI Copilot (policy generation)",
    ],
    plans: ["explorer", "starter"],
  },
  Assure: {
    name: "Assure",
    tagline: "Continuous Alignment & Runtime Governance",
    highlights: [
      "Everything in Core, plus:",
      "Drift detection & alerts",
      "Escalation workflows",
      "Runtime monitoring",
      "Incident capture & declarations",
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
