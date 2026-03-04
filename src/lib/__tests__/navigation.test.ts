import { describe, it, expect } from "vitest";
import { meetsMinTier, getTierName, navSections } from "@/lib/navigation";

// ---------------------------------------------------------------------------
// meetsMinTier
// ---------------------------------------------------------------------------
describe("meetsMinTier", () => {
  it("null minTier always returns true", () => {
    expect(meetsMinTier("explorer", null)).toBe(true);
    expect(meetsMinTier("pro", null)).toBe(true);
    expect(meetsMinTier(null, null)).toBe(true);
  });

  it('explorer meets null but not "pro"', () => {
    expect(meetsMinTier("explorer", null)).toBe(true);
    expect(meetsMinTier("explorer", "pro")).toBe(false);
  });

  it('pro meets "pro" but not "enterprise"', () => {
    expect(meetsMinTier("pro", "pro")).toBe(true);
    expect(meetsMinTier("pro", "enterprise")).toBe(false);
  });

  it("enterprise meets all tiers", () => {
    expect(meetsMinTier("enterprise", "explorer")).toBe(true);
    expect(meetsMinTier("enterprise", "starter")).toBe(true);
    expect(meetsMinTier("enterprise", "pro")).toBe(true);
    expect(meetsMinTier("enterprise", "enterprise")).toBe(true);
  });

  it("null/undefined user plan defaults to explorer", () => {
    expect(meetsMinTier(null, "pro")).toBe(false);
    expect(meetsMinTier(undefined, "starter")).toBe(false);
    expect(meetsMinTier(null, "explorer")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTierName
// ---------------------------------------------------------------------------
describe("getTierName", () => {
  it('explorer maps to "Core"', () => {
    expect(getTierName("explorer")).toBe("Core");
  });

  it('starter maps to "Core"', () => {
    expect(getTierName("starter")).toBe("Core");
  });

  it('pro maps to "Assure"', () => {
    expect(getTierName("pro")).toBe("Assure");
  });

  it('enterprise maps to "Verify"', () => {
    expect(getTierName("enterprise")).toBe("Verify");
  });

  it('null defaults to "Core"', () => {
    expect(getTierName(null)).toBe("Core");
  });
});

// ---------------------------------------------------------------------------
// navSections
// ---------------------------------------------------------------------------
describe("navSections", () => {
  const sectionIds = navSections.map((s) => s.id);

  it("has expected section IDs", () => {
    expect(sectionIds).toContain("overview");
    expect(sectionIds).toContain("govern");
    expect(sectionIds).toContain("monitor");
    expect(sectionIds).toContain("prove");
    expect(sectionIds).toContain("report");
    expect(sectionIds).toContain("settings");
  });

  it('prove section requires "enterprise" minTier', () => {
    const prove = navSections.find((s) => s.id === "prove");
    expect(prove).toBeDefined();
    expect(prove!.minTier).toBe("enterprise");
  });

  it('monitor section requires "pro" minTier', () => {
    const monitor = navSections.find((s) => s.id === "monitor");
    expect(monitor).toBeDefined();
    expect(monitor!.minTier).toBe("pro");
  });

  it("all items have required fields (label, href, icon, exists)", () => {
    for (const section of navSections) {
      for (const item of section.items) {
        expect(typeof item.label).toBe("string");
        expect(item.label.length).toBeGreaterThan(0);
        expect(typeof item.href).toBe("string");
        expect(item.href.startsWith("/")).toBe(true);
        expect(typeof item.icon).toBe("string");
        expect(item.icon.length).toBeGreaterThan(0);
        expect(typeof item.exists).toBe("boolean");
      }
    }
  });
});
