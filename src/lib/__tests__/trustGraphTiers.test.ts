import { describe, it, expect } from "vitest";
import {
  getTier,
  getTierConfig,
  getTierForScore,
  TIER_THRESHOLDS,
  type TierKey,
} from "@/lib/trustGraphTiers";

// ---------------------------------------------------------------------------
// getTier — Score to TierKey mapping
// ---------------------------------------------------------------------------

describe("getTier", () => {
  it("returns 'trusted' for scores >= 80", () => {
    expect(getTier(80)).toBe("trusted");
    expect(getTier(90)).toBe("trusted");
    expect(getTier(100)).toBe("trusted");
  });

  it("returns 'stable' for scores >= 65 and < 80", () => {
    expect(getTier(65)).toBe("stable");
    expect(getTier(70)).toBe("stable");
    expect(getTier(79)).toBe("stable");
  });

  it("returns 'elevated_risk' for scores >= 50 and < 65", () => {
    expect(getTier(50)).toBe("elevated_risk");
    expect(getTier(55)).toBe("elevated_risk");
    expect(getTier(64)).toBe("elevated_risk");
  });

  it("returns 'critical' for scores < 50", () => {
    expect(getTier(0)).toBe("critical");
    expect(getTier(25)).toBe("critical");
    expect(getTier(49)).toBe("critical");
  });

  it("handles boundary values exactly", () => {
    // Boundary at 80: exactly 80 is trusted
    expect(getTier(79.999)).toBe("stable");
    expect(getTier(80)).toBe("trusted");

    // Boundary at 65: exactly 65 is stable
    expect(getTier(64.999)).toBe("elevated_risk");
    expect(getTier(65)).toBe("stable");

    // Boundary at 50: exactly 50 is elevated_risk
    expect(getTier(49.999)).toBe("critical");
    expect(getTier(50)).toBe("elevated_risk");
  });
});

// ---------------------------------------------------------------------------
// getTierConfig — TierKey to display config
// ---------------------------------------------------------------------------

describe("getTierConfig", () => {
  it("returns config for 'trusted' tier", () => {
    const config = getTierConfig("trusted");
    expect(config.key).toBe("trusted");
    expect(config.label).toBe("Trusted");
    expect(config.hex).toBe("#16a34a");
    expect(config.colorClass).toBe("text-tier-trusted");
    expect(config.bgClass).toBe("bg-tier-trusted/10");
  });

  it("returns config for 'stable' tier", () => {
    const config = getTierConfig("stable");
    expect(config.key).toBe("stable");
    expect(config.label).toBe("Stable");
    expect(config.hex).toBe("#2563eb");
  });

  it("returns config for 'elevated_risk' tier", () => {
    const config = getTierConfig("elevated_risk");
    expect(config.key).toBe("elevated_risk");
    expect(config.label).toBe("Elevated Risk");
    expect(config.hex).toBe("#d97706");
  });

  it("returns config for 'critical' tier", () => {
    const config = getTierConfig("critical");
    expect(config.key).toBe("critical");
    expect(config.label).toBe("Critical");
    expect(config.hex).toBe("#dc2626");
  });

  it("all configs have required fields", () => {
    const tiers: TierKey[] = ["trusted", "stable", "elevated_risk", "critical"];
    for (const tier of tiers) {
      const config = getTierConfig(tier);
      expect(config.key).toBeDefined();
      expect(config.label).toBeDefined();
      expect(config.colorClass).toBeDefined();
      expect(config.bgClass).toBeDefined();
      expect(config.hex).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// getTierForScore — Combined score to config lookup
// ---------------------------------------------------------------------------

describe("getTierForScore", () => {
  it("returns complete config for a score", () => {
    const config = getTierForScore(85);
    expect(config.key).toBe("trusted");
    expect(config.label).toBe("Trusted");
    expect(config.hex).toBe("#16a34a");
  });

  it("works for all score ranges", () => {
    expect(getTierForScore(95).key).toBe("trusted");
    expect(getTierForScore(70).key).toBe("stable");
    expect(getTierForScore(55).key).toBe("elevated_risk");
    expect(getTierForScore(30).key).toBe("critical");
  });

  it("matches getTierConfig(getTier(score))", () => {
    const scores = [0, 30, 50, 65, 80, 100];
    for (const score of scores) {
      const config1 = getTierForScore(score);
      const config2 = getTierConfig(getTier(score));
      expect(config1).toEqual(config2);
    }
  });
});

// ---------------------------------------------------------------------------
// TIER_THRESHOLDS constants
// ---------------------------------------------------------------------------

describe("TIER_THRESHOLDS", () => {
  it("has all required thresholds", () => {
    expect(TIER_THRESHOLDS.TRUSTED).toBe(80);
    expect(TIER_THRESHOLDS.STABLE).toBe(65);
    expect(TIER_THRESHOLDS.ELEVATED_RISK).toBe(50);
  });

  it("thresholds are in descending order", () => {
    expect(TIER_THRESHOLDS.TRUSTED).toBeGreaterThan(TIER_THRESHOLDS.STABLE);
    expect(TIER_THRESHOLDS.STABLE).toBeGreaterThan(TIER_THRESHOLDS.ELEVATED_RISK);
  });
});
