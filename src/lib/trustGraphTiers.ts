// Pure tier classification functions for TrustGraph scoring.
// No React, no side-effects.

export type TierKey = "trusted" | "stable" | "elevated_risk" | "critical";

export type TierConfig = {
  key: TierKey;
  label: string;
  colorClass: string;
  bgClass: string;
  hex: string;
};

const TIER_CONFIGS: Record<TierKey, TierConfig> = {
  trusted: {
    key: "trusted",
    label: "Trusted",
    colorClass: "text-tier-trusted",
    bgClass: "bg-tier-trusted/10",
    hex: "#16a34a",
  },
  stable: {
    key: "stable",
    label: "Stable",
    colorClass: "text-tier-stable",
    bgClass: "bg-tier-stable/10",
    hex: "#2563eb",
  },
  elevated_risk: {
    key: "elevated_risk",
    label: "Elevated Risk",
    colorClass: "text-tier-elevated",
    bgClass: "bg-tier-elevated/10",
    hex: "#d97706",
  },
  critical: {
    key: "critical",
    label: "Critical",
    colorClass: "text-tier-critical",
    bgClass: "bg-tier-critical/10",
    hex: "#dc2626",
  },
};

/** Score (0-100) → tier key */
export function getTier(score: number): TierKey {
  if (score >= 80) return "trusted";
  if (score >= 65) return "stable";
  if (score >= 50) return "elevated_risk";
  return "critical";
}

/** Get display config for a tier */
export function getTierConfig(tier: TierKey): TierConfig {
  return TIER_CONFIGS[tier];
}

/** Convenience: score → full config */
export function getTierForScore(score: number): TierConfig {
  return TIER_CONFIGS[getTier(score)];
}
