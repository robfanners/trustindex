import { describe, it, expect } from "vitest";
import {
  getPlanLimits,
  canCreateSurvey,
  canCreateSystem,
  canExportResults,
  isPaidPlan,
  maxVendors,
  maxIncidentsPerMonth,
  maxPolicyGenerations,
  maxTeamMembers,
  canManageTeam,
  canAccessWizard,
  getReportLevel,
} from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// getPlanLimits
// ---------------------------------------------------------------------------
describe("getPlanLimits", () => {
  it("returns correct limits for explorer", () => {
    const limits = getPlanLimits("explorer");
    expect(limits).toEqual({ maxSurveys: 1, maxSystems: 0, canExport: false });
  });

  it("returns correct limits for starter", () => {
    const limits = getPlanLimits("starter");
    expect(limits).toEqual({ maxSurveys: 1, maxSystems: 0, canExport: false });
  });

  it("returns correct limits for pro", () => {
    const limits = getPlanLimits("pro");
    expect(limits).toEqual({ maxSurveys: 5, maxSystems: 2, canExport: true });
  });

  it("returns correct limits for enterprise", () => {
    const limits = getPlanLimits("enterprise");
    expect(limits).toEqual({
      maxSurveys: Infinity,
      maxSystems: Infinity,
      canExport: true,
    });
  });

  it("defaults null to explorer limits", () => {
    expect(getPlanLimits(null)).toEqual(getPlanLimits("explorer"));
  });

  it("defaults undefined to explorer limits", () => {
    expect(getPlanLimits(undefined)).toEqual(getPlanLimits("explorer"));
  });
});

// ---------------------------------------------------------------------------
// canCreateSurvey
// ---------------------------------------------------------------------------
describe("canCreateSurvey", () => {
  it("explorer can create a survey when count is 0", () => {
    expect(canCreateSurvey("explorer", 0)).toBe(true);
  });

  it("explorer cannot create a survey when count is 1", () => {
    expect(canCreateSurvey("explorer", 1)).toBe(false);
  });

  it("enterprise can create a survey even with count 999", () => {
    expect(canCreateSurvey("enterprise", 999)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canCreateSystem
// ---------------------------------------------------------------------------
describe("canCreateSystem", () => {
  it("explorer cannot create any systems", () => {
    expect(canCreateSystem("explorer", 0)).toBe(false);
  });

  it("pro can create a system when count is 0", () => {
    expect(canCreateSystem("pro", 0)).toBe(true);
  });

  it("pro can create a system when count is 1", () => {
    expect(canCreateSystem("pro", 1)).toBe(true);
  });

  it("pro cannot create a system when count is 2", () => {
    expect(canCreateSystem("pro", 2)).toBe(false);
  });

  it("enterprise can always create systems", () => {
    expect(canCreateSystem("enterprise", 1000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canExportResults
// ---------------------------------------------------------------------------
describe("canExportResults", () => {
  it("returns false for explorer", () => {
    expect(canExportResults("explorer")).toBe(false);
  });

  it("returns false for starter", () => {
    expect(canExportResults("starter")).toBe(false);
  });

  it("returns true for pro", () => {
    expect(canExportResults("pro")).toBe(true);
  });

  it("returns true for enterprise", () => {
    expect(canExportResults("enterprise")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isPaidPlan
// ---------------------------------------------------------------------------
describe("isPaidPlan", () => {
  it("returns false for explorer", () => {
    expect(isPaidPlan("explorer")).toBe(false);
  });

  it("returns true for starter", () => {
    expect(isPaidPlan("starter")).toBe(true);
  });

  it("returns true for pro", () => {
    expect(isPaidPlan("pro")).toBe(true);
  });

  it("returns true for enterprise", () => {
    expect(isPaidPlan("enterprise")).toBe(true);
  });

  it("defaults null to false (explorer)", () => {
    expect(isPaidPlan(null)).toBe(false);
  });

  it("defaults undefined to false (explorer)", () => {
    expect(isPaidPlan(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// maxVendors
// ---------------------------------------------------------------------------
describe("maxVendors", () => {
  it("returns 0 for explorer", () => {
    expect(maxVendors("explorer")).toBe(0);
  });

  it("returns 10 for starter", () => {
    expect(maxVendors("starter")).toBe(10);
  });

  it("returns Infinity for pro", () => {
    expect(maxVendors("pro")).toBe(Infinity);
  });

  it("returns Infinity for enterprise", () => {
    expect(maxVendors("enterprise")).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// maxIncidentsPerMonth
// ---------------------------------------------------------------------------
describe("maxIncidentsPerMonth", () => {
  it("returns 0 for explorer", () => {
    expect(maxIncidentsPerMonth("explorer")).toBe(0);
  });

  it("returns 5 for starter", () => {
    expect(maxIncidentsPerMonth("starter")).toBe(5);
  });

  it("returns Infinity for pro", () => {
    expect(maxIncidentsPerMonth("pro")).toBe(Infinity);
  });

  it("returns Infinity for enterprise", () => {
    expect(maxIncidentsPerMonth("enterprise")).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// maxPolicyGenerations
// ---------------------------------------------------------------------------
describe("maxPolicyGenerations", () => {
  it("returns 0 for explorer", () => {
    expect(maxPolicyGenerations("explorer")).toBe(0);
  });

  it("returns 3 for starter", () => {
    expect(maxPolicyGenerations("starter")).toBe(3);
  });

  it("returns 10 for pro", () => {
    expect(maxPolicyGenerations("pro")).toBe(10);
  });

  it("returns 50 for enterprise", () => {
    expect(maxPolicyGenerations("enterprise")).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// maxTeamMembers
// ---------------------------------------------------------------------------
describe("maxTeamMembers", () => {
  it("returns 1 for explorer", () => {
    expect(maxTeamMembers("explorer")).toBe(1);
  });

  it("returns 1 for starter", () => {
    expect(maxTeamMembers("starter")).toBe(1);
  });

  it("returns 5 for pro", () => {
    expect(maxTeamMembers("pro")).toBe(5);
  });

  it("returns Infinity for enterprise", () => {
    expect(maxTeamMembers("enterprise")).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// canManageTeam
// ---------------------------------------------------------------------------
describe("canManageTeam", () => {
  it("returns false for explorer", () => {
    expect(canManageTeam("explorer")).toBe(false);
  });

  it("returns false for starter", () => {
    expect(canManageTeam("starter")).toBe(false);
  });

  it("returns true for pro", () => {
    expect(canManageTeam("pro")).toBe(true);
  });

  it("returns true for enterprise", () => {
    expect(canManageTeam("enterprise")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canAccessWizard
// ---------------------------------------------------------------------------
describe("canAccessWizard", () => {
  it("returns false for explorer", () => {
    expect(canAccessWizard("explorer")).toBe(false);
  });

  it("returns true for starter", () => {
    expect(canAccessWizard("starter")).toBe(true);
  });

  it("returns true for pro", () => {
    expect(canAccessWizard("pro")).toBe(true);
  });

  it("returns true for enterprise", () => {
    expect(canAccessWizard("enterprise")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getReportLevel
// ---------------------------------------------------------------------------
describe("getReportLevel", () => {
  it('returns "none" for explorer', () => {
    expect(getReportLevel("explorer")).toBe("none");
  });

  it('returns "basic" for starter', () => {
    expect(getReportLevel("starter")).toBe("basic");
  });

  it('returns "full" for pro', () => {
    expect(getReportLevel("pro")).toBe("full");
  });

  it('returns "full" for enterprise', () => {
    expect(getReportLevel("enterprise")).toBe("full");
  });

  it('defaults null to "none" (explorer)', () => {
    expect(getReportLevel(null)).toBe("none");
  });
});
