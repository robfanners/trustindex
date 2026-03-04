import { describe, it, expect } from "vitest";
import { planToTier, getTierInfo, hasTierAccess, TIERS } from "@/lib/tiers";

// ---------------------------------------------------------------------------
// planToTier
// ---------------------------------------------------------------------------
describe("planToTier", () => {
  it("maps explorer to Core", () => {
    expect(planToTier("explorer")).toBe("Core");
  });

  it("maps starter to Core", () => {
    expect(planToTier("starter")).toBe("Core");
  });

  it("maps pro to Assure", () => {
    expect(planToTier("pro")).toBe("Assure");
  });

  it("maps enterprise to Verify", () => {
    expect(planToTier("enterprise")).toBe("Verify");
  });

  it("defaults null to Core", () => {
    expect(planToTier(null)).toBe("Core");
  });

  it("defaults undefined to Core", () => {
    expect(planToTier(undefined)).toBe("Core");
  });

  it("defaults unknown string to Core", () => {
    expect(planToTier("nonexistent")).toBe("Core");
  });
});

// ---------------------------------------------------------------------------
// hasTierAccess
// ---------------------------------------------------------------------------
describe("hasTierAccess", () => {
  it("explorer has Core access", () => {
    expect(hasTierAccess("explorer", "Core")).toBe(true);
  });

  it("explorer does not have Assure access", () => {
    expect(hasTierAccess("explorer", "Assure")).toBe(false);
  });

  it("explorer does not have Verify access", () => {
    expect(hasTierAccess("explorer", "Verify")).toBe(false);
  });

  it("pro has Core access", () => {
    expect(hasTierAccess("pro", "Core")).toBe(true);
  });

  it("pro has Assure access", () => {
    expect(hasTierAccess("pro", "Assure")).toBe(true);
  });

  it("pro does not have Verify access", () => {
    expect(hasTierAccess("pro", "Verify")).toBe(false);
  });

  it("enterprise has Core access", () => {
    expect(hasTierAccess("enterprise", "Core")).toBe(true);
  });

  it("enterprise has Assure access", () => {
    expect(hasTierAccess("enterprise", "Assure")).toBe(true);
  });

  it("enterprise has Verify access", () => {
    expect(hasTierAccess("enterprise", "Verify")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTierInfo
// ---------------------------------------------------------------------------
describe("getTierInfo", () => {
  it("returns Core tier info for explorer", () => {
    const info = getTierInfo("explorer");
    expect(info.name).toBe("Core");
    expect(info.plans).toContain("explorer");
  });

  it("returns Assure tier info for pro", () => {
    const info = getTierInfo("pro");
    expect(info.name).toBe("Assure");
    expect(info.plans).toContain("pro");
  });

  it("returns Verify tier info for enterprise", () => {
    const info = getTierInfo("enterprise");
    expect(info.name).toBe("Verify");
    expect(info.plans).toContain("enterprise");
  });
});

// ---------------------------------------------------------------------------
// TIERS structure
// ---------------------------------------------------------------------------
describe("TIERS structure", () => {
  it.each(["Core", "Assure", "Verify"] as const)(
    "%s tier has name, tagline, highlights, and plans",
    (tier) => {
      const info = TIERS[tier];
      expect(info.name).toBe(tier);
      expect(typeof info.tagline).toBe("string");
      expect(info.tagline.length).toBeGreaterThan(0);
      expect(Array.isArray(info.highlights)).toBe(true);
      expect(info.highlights.length).toBeGreaterThan(0);
      expect(Array.isArray(info.plans)).toBe(true);
      expect(info.plans.length).toBeGreaterThan(0);
    }
  );
});
