import { describe, it, expect } from "vitest";
import {
  meetsMinTier,
  getTierName,
  navSections,
  getItemMinTier,
  getItemTierBadge,
  type NavItem,
  type NavSection,
} from "@/lib/navigation";

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

  it('Drift & Alerts has value-slice item-level minTier "starter" (Phase 2 — Basic Drift on Core)', () => {
    const monitor = navSections.find((s) => s.id === "monitor");
    const drift = monitor!.items.find((i) => i.href === "/monitor/drift");
    expect(drift).toBeDefined();
    expect(drift!.minTier).toBe("starter");
  });

  it("other Monitor items still fall back to section-level pro gate (no item override)", () => {
    const monitor = navSections.find((s) => s.id === "monitor");
    const nonDriftItems = monitor!.items.filter((i) => i.href !== "/monitor/drift");
    for (const item of nonDriftItems) {
      // No per-item minTier set — falls through to section.minTier ("pro")
      expect(item.minTier).toBeUndefined();
    }
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

// ---------------------------------------------------------------------------
// Value-slice per-item gating helpers (2026-06-30)
// See docs/plans/2026-06-30-value-slice-pricing.md
// ---------------------------------------------------------------------------

const mockSection: NavSection = {
  id: "monitor",
  label: "MONITOR",
  minTier: "pro",
  tierBadge: "Assure",
  items: [],
};

describe("getItemMinTier (value-slice)", () => {
  it("falls back to section minTier when item has none set", () => {
    const item: NavItem = {
      label: "Drift & Alerts",
      href: "/monitor/drift",
      icon: "drift-alerts",
      exists: true,
    };
    expect(getItemMinTier(item, mockSection)).toBe("pro");
  });

  it("uses item's own minTier when set (Phase 2+ can move items down-tier)", () => {
    const item: NavItem = {
      label: "Drift & Alerts",
      href: "/monitor/drift",
      icon: "drift-alerts",
      exists: true,
      minTier: "starter", // Phase 2 target for Basic Drift
    };
    expect(getItemMinTier(item, mockSection)).toBe("starter");
  });

  it("honours item's explicit null (available to all) even if section is locked", () => {
    const item: NavItem = {
      label: "Verification",
      href: "/prove/verification",
      icon: "verification",
      exists: true,
      minTier: null, // Verification is a viral hook — available at any tier
    };
    expect(getItemMinTier(item, mockSection)).toBe(null);
  });
});

describe("getItemTierBadge (value-slice)", () => {
  it("falls back to section tierBadge when item has none set", () => {
    const item: NavItem = {
      label: "Escalations",
      href: "/monitor/escalations",
      icon: "escalations",
      exists: true,
    };
    expect(getItemTierBadge(item, mockSection)).toBe("Assure");
  });

  it("uses item's own tierBadge when set (e.g., chain-anchored item inside Assure section)", () => {
    const item: NavItem = {
      label: "Chain-Anchored Attestations",
      href: "/prove/attestations",
      icon: "attestations",
      exists: true,
      minTier: "enterprise",
      tierBadge: "Verify",
    };
    expect(getItemTierBadge(item, mockSection)).toBe("Verify");
  });

  it("returns undefined when neither section nor item sets a badge", () => {
    const bareSection: NavSection = {
      id: "overview",
      label: "",
      minTier: null,
      items: [],
    };
    const item: NavItem = {
      label: "Control Centre",
      href: "/dashboard",
      icon: "layout-dashboard",
      exists: true,
    };
    expect(getItemTierBadge(item, bareSection)).toBeUndefined();
  });
});
