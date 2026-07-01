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
  // Value-slice (2026-06-30)
  canAccessBasicDrift,
  getMaxDriftSystems,
  canUseNonChainLedger,
  canUseNonChainIncidentLock,
  canUseChainAnchoring,
  canVerifyExternalProofs,
  canIssueAttestations,
  canExportOwnData,
  getBasicIncidentQuota,
} from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// getPlanLimits
// ---------------------------------------------------------------------------
describe("getPlanLimits", () => {
  it("returns correct limits for explorer (value-slice: canExport=true for own data)", () => {
    const limits = getPlanLimits("explorer");
    expect(limits).toEqual({ maxSurveys: 1, maxSystems: 0, canExport: true });
  });

  it("returns correct limits for starter (Core)", () => {
    const limits = getPlanLimits("starter");
    expect(limits).toEqual({ maxSurveys: 2, maxSystems: 2, canExport: true });
  });

  it("returns correct limits for pro (Assure)", () => {
    const limits = getPlanLimits("pro");
    expect(limits).toEqual({ maxSurveys: 6, maxSystems: 6, canExport: true });
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

  it("pro can create a system when count is 5", () => {
    expect(canCreateSystem("pro", 5)).toBe(true);
  });

  it("pro cannot create a system when count is 6", () => {
    expect(canCreateSystem("pro", 6)).toBe(false);
  });

  it("enterprise can always create systems", () => {
    expect(canCreateSystem("enterprise", 1000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canExportResults
// ---------------------------------------------------------------------------
describe("canExportResults", () => {
  it("returns true for explorer (value-slice: free tier controls own data)", () => {
    expect(canExportResults("explorer")).toBe(true);
  });

  it("returns true for starter (Core has CSV export)", () => {
    expect(canExportResults("starter")).toBe(true);
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

// ---------------------------------------------------------------------------
// Value-slice per-feature entitlements (2026-06-30)
// See docs/plans/2026-06-30-value-slice-pricing.md
// ---------------------------------------------------------------------------

describe("canAccessBasicDrift (value-slice Phase 2)", () => {
  it("returns false for explorer", () => {
    expect(canAccessBasicDrift("explorer")).toBe(false);
  });

  it("returns true for starter (Core gets Basic Drift, Phase 2 live)", () => {
    expect(canAccessBasicDrift("starter")).toBe(true);
  });

  it("returns true for pro", () => {
    expect(canAccessBasicDrift("pro")).toBe(true);
  });

  it("returns true for enterprise", () => {
    expect(canAccessBasicDrift("enterprise")).toBe(true);
  });
});

describe("getMaxDriftSystems (value-slice Phase 2)", () => {
  it("returns 0 for explorer", () => {
    expect(getMaxDriftSystems("explorer")).toBe(0);
  });

  it("returns 2 for starter (Core = Basic Drift on 2 systems)", () => {
    expect(getMaxDriftSystems("starter")).toBe(2);
  });

  it("returns 6 for pro (Assure = Full Drift on 6 systems)", () => {
    expect(getMaxDriftSystems("pro")).toBe(6);
  });

  it("returns Infinity for enterprise", () => {
    expect(getMaxDriftSystems("enterprise")).toBe(Infinity);
  });
});

describe("canUseNonChainLedger (value-slice Phase 4)", () => {
  it("returns false for explorer", () => {
    expect(canUseNonChainLedger("explorer")).toBe(false);
  });

  it("returns true for starter (Core gets non-chain Decision Ledger)", () => {
    expect(canUseNonChainLedger("starter")).toBe(true);
  });

  it("returns true for pro", () => {
    expect(canUseNonChainLedger("pro")).toBe(true);
  });

  it("returns true for enterprise (Verify gets on-chain too — canUseChainAnchoring)", () => {
    expect(canUseNonChainLedger("enterprise")).toBe(true);
  });
});

describe("canUseNonChainIncidentLock (value-slice Phase 4)", () => {
  it("returns false for explorer", () => {
    expect(canUseNonChainIncidentLock("explorer")).toBe(false);
  });

  it("returns true for starter (Core gets non-chain Incident Lock)", () => {
    expect(canUseNonChainIncidentLock("starter")).toBe(true);
  });

  it("returns true for pro", () => {
    expect(canUseNonChainIncidentLock("pro")).toBe(true);
  });

  it("returns true for enterprise", () => {
    expect(canUseNonChainIncidentLock("enterprise")).toBe(true);
  });
});

describe("canUseChainAnchoring (value-slice: the Verify moat)", () => {
  it("returns false for all non-enterprise plans", () => {
    expect(canUseChainAnchoring("explorer")).toBe(false);
    expect(canUseChainAnchoring("starter")).toBe(false);
    expect(canUseChainAnchoring("pro")).toBe(false);
  });

  it("returns true for enterprise (the moat)", () => {
    expect(canUseChainAnchoring("enterprise")).toBe(true);
  });
});

describe("canVerifyExternalProofs (value-slice Phase 3: viral hook)", () => {
  it("returns true for any signed-in plan", () => {
    expect(canVerifyExternalProofs("explorer")).toBe(true);
    expect(canVerifyExternalProofs("starter")).toBe(true);
    expect(canVerifyExternalProofs("pro")).toBe(true);
    expect(canVerifyExternalProofs("enterprise")).toBe(true);
  });

  it("returns true for unauthenticated users (public /verify/[id] route is live)", () => {
    // Phase 3 shipped 2026-06-30 — verification is now the Explorer viral
    // hook, available to anyone with a verification ID without a Verisum
    // account. See src/app/verify/[id]/page.tsx + proxy.ts whitelist.
    expect(canVerifyExternalProofs(null)).toBe(true);
    expect(canVerifyExternalProofs(undefined)).toBe(true);
  });
});

describe("canIssueAttestations (value-slice)", () => {
  it("returns false for explorer + starter", () => {
    expect(canIssueAttestations("explorer")).toBe(false);
    expect(canIssueAttestations("starter")).toBe(false);
  });

  it("returns true for pro + enterprise", () => {
    expect(canIssueAttestations("pro")).toBe(true);
    expect(canIssueAttestations("enterprise")).toBe(true);
  });
});

describe("canExportOwnData (value-slice: free tier controls own data)", () => {
  it("returns true for every plan including explorer", () => {
    expect(canExportOwnData("explorer")).toBe(true);
    expect(canExportOwnData("starter")).toBe(true);
    expect(canExportOwnData("pro")).toBe(true);
    expect(canExportOwnData("enterprise")).toBe(true);
    expect(canExportOwnData(null)).toBe(true);
  });
});

describe("getBasicIncidentQuota (value-slice)", () => {
  it("mirrors maxIncidentsPerMonth for parity", () => {
    expect(getBasicIncidentQuota("explorer")).toBe(0);
    expect(getBasicIncidentQuota("starter")).toBe(5);
    expect(getBasicIncidentQuota("pro")).toBe(Infinity);
    expect(getBasicIncidentQuota("enterprise")).toBe(Infinity);
  });
});
