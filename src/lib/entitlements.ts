/**
 * Plan entitlements — single source of truth for all plan-based limits.
 *
 * Pure functions at the top are safe for client + server use.
 * Server-only helpers (DB queries) are at the bottom and import supabaseServer.
 */

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export type PlanName = "explorer" | "starter" | "pro" | "enterprise";

// Plan limit constants for display/pricing pages
// Customer-facing names: Core (=starter), Assure (=pro), Verify (=enterprise)
export const PLAN_CONSTANTS = {
  STARTER: {
    SURVEYS: 2,
    SYSTEMS: 2,
    STAFF_DECLARATIONS: 50,
    VENDORS: 10,
    INCIDENTS_PER_MONTH: 5,
    TEAM_MEMBERS: 1,
    POLICY_GENERATIONS: 3,
  },
  PRO: {
    SURVEYS: 6,
    SYSTEMS: 6,
    STAFF_DECLARATIONS: 250,
    VENDORS: Infinity,
    INCIDENTS_PER_MONTH: Infinity,
    TEAM_MEMBERS: 5,
    POLICY_GENERATIONS: 10,
  },
} as const;

export type PlanLimits = {
  maxSurveys: number; // Infinity for enterprise
  maxSystems: number; // Infinity for enterprise
  canExport: boolean;
};

// ---------------------------------------------------------------------------
// Pure helpers (client + server safe)
// ---------------------------------------------------------------------------

const LIMITS: Record<PlanName, PlanLimits> = {
  // Value-slice update (2026-06-30): Explorer now exports their OWN data.
  // Free tier should give full control of own single result — see
  // docs/plans/2026-06-30-value-slice-pricing.md. Multi-user / advanced
  // export features still gated by tier.
  explorer: { maxSurveys: 1, maxSystems: 0, canExport: true },
  starter: { maxSurveys: 2, maxSystems: 2, canExport: true },
  pro: { maxSurveys: 6, maxSystems: 6, canExport: true },
  enterprise: { maxSurveys: Infinity, maxSystems: Infinity, canExport: true },
};

/** Plan-specific feature limits — single source of truth for UI + enforcement */
export const PLAN_LIMITS = {
  explorer: {
    maxStaffDeclarations: 0,
    maxVendors: 0,
    maxIncidentsPerMonth: 0,
    maxTeamMembers: 1,
    maxPolicyGenerations: 0,
  },
  starter: {
    maxStaffDeclarations: 50,
    maxVendors: 10,
    maxIncidentsPerMonth: 5,
    maxTeamMembers: 1,
    maxPolicyGenerations: 3,
  },
  pro: {
    maxStaffDeclarations: 250,
    maxVendors: Infinity,
    maxIncidentsPerMonth: Infinity,
    maxTeamMembers: 5,
    maxPolicyGenerations: 10,
  },
  enterprise: {
    maxStaffDeclarations: Infinity,
    maxVendors: Infinity,
    maxIncidentsPerMonth: Infinity,
    maxTeamMembers: Infinity,
    maxPolicyGenerations: 50,
  },
} as const;

/** Return the limits object for a given plan. Defaults to explorer. */
export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  const key = (plan ?? "explorer") as PlanName;
  return LIMITS[key] ?? LIMITS.explorer;
}

/** Can the user create another survey? */
export function canCreateSurvey(plan: string | null | undefined, currentCount: number): boolean {
  return currentCount < getPlanLimits(plan).maxSurveys;
}

/** Can the user create another system? (Task 4+) */
export function canCreateSystem(plan: string | null | undefined, currentCount: number): boolean {
  return currentCount < getPlanLimits(plan).maxSystems;
}

/** Can the user export results? */
export function canExportResults(plan: string | null | undefined): boolean {
  return getPlanLimits(plan).canExport;
}

/** Can the user access billing settings? (Starter+) */
export function hasBillingAccess(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "starter" || p === "pro" || p === "enterprise";
}

/** Can the user manage team members? (Pro+ — basic for Pro, full for Enterprise) */
export function canManageTeam(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "pro" || p === "enterprise";
}

/** Max team members allowed */
export function maxTeamMembers(plan: string | null | undefined): number {
  const p = (plan ?? "explorer") as PlanName;
  return PLAN_LIMITS[p]?.maxTeamMembers ?? 1;
}

/** Can the user access data & export settings? (Core+) */
export function canAccessDataSettings(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "starter" || p === "pro" || p === "enterprise";
}

// ---------------------------------------------------------------------------
// Copilot feature entitlements (client + server safe)
// ---------------------------------------------------------------------------

/** Is this a paid plan? (Starter+) */
export function isPaidPlan(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "starter" || p === "pro" || p === "enterprise";
}

/** Max staff declarations allowed */
export function maxStaffDeclarations(plan: string | null | undefined): number {
  const p = (plan ?? "explorer") as PlanName;
  return PLAN_LIMITS[p]?.maxStaffDeclarations ?? 0;
}

/** Max AI vendors allowed */
export function maxVendors(plan: string | null | undefined): number {
  const p = (plan ?? "explorer") as PlanName;
  return PLAN_LIMITS[p]?.maxVendors ?? 0;
}

/** Max incidents per month */
export function maxIncidentsPerMonth(plan: string | null | undefined): number {
  const p = (plan ?? "explorer") as PlanName;
  return PLAN_LIMITS[p]?.maxIncidentsPerMonth ?? 0;
}

/** Max AI policy generations per month */
export function maxPolicyGenerations(plan: string | null | undefined): number {
  const p = (plan ?? "explorer") as PlanName;
  return PLAN_LIMITS[p]?.maxPolicyGenerations ?? 0;
}

/** Can generate AI policies? (Starter+) */
export function canGeneratePolicy(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}

/** Can edit generated AI policies? (Pro+) */
export function canEditPolicy(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "pro" || p === "enterprise";
}

/** Can access AI Governance Setup Wizard? (Starter+) */
export function canAccessWizard(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}

/** Can generate governance pack? (Starter+) */
export function canGeneratePack(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}

/** Can access monthly compliance report? (Starter+) */
export function canAccessMonthlyReport(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}

/** Get compliance report level */
export function getReportLevel(plan: string | null | undefined): "none" | "basic" | "full" {
  const p = plan ?? "explorer";
  if (p === "starter") return "basic";
  if (p === "pro" || p === "enterprise") return "full";
  return "none";
}

// ---------------------------------------------------------------------------
// Intent-Based Governance (IBG) entitlements
// ---------------------------------------------------------------------------

/** Can the user view IBG specifications? (Starter+ — read-only preview) */
export function canViewIBG(plan: string | null | undefined): boolean {
  return isPaidPlan(plan);
}

/** Can the user create/edit IBG specifications? (Pro+) */
export function canManageIBG(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "pro" || p === "enterprise";
}

// ---------------------------------------------------------------------------
// Value-slice per-feature entitlements (2026-06-30)
//
// See docs/plans/2026-06-30-value-slice-pricing.md.
//
// Under value-slice pricing, every tier gets *some* capability in every
// product pillar (Govern, Monitor, Prove). These helpers gate individual
// features per-plan rather than gating entire modules by minTier.
//
// Currently these mirror the old bundle behaviour so nothing breaks on
// merge. Phase 2+ PRs will progressively relax specific gates (e.g., move
// Basic Drift from Pro+ down to Starter+ once the Basic Drift feature ships).
// ---------------------------------------------------------------------------

/**
 * Can the user access Drift monitoring on their own AI systems?
 * Value-slice Phase 2 (2026-06-30): Core+ gets Basic Drift (2 systems,
 * read-only alerts, no escalation, no signals). Assure+ gets Full Drift.
 */
export function canAccessBasicDrift(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "starter" || p === "pro" || p === "enterprise";
}

/**
 * Maximum number of AI systems the user can enable drift monitoring on.
 * Core = 2 (Basic Drift), Assure = 6 (Full Drift), Verify = unlimited.
 */
export function getMaxDriftSystems(plan: string | null | undefined): number {
  const p = (plan ?? "explorer") as PlanName;
  if (p === "enterprise") return Infinity;
  if (p === "pro") return 6;
  if (p === "starter") return 2;
  return 0;
}

/**
 * Can the user access the non-chain Decision Ledger (own records, tamper-
 * evident but not on-chain-anchored)?
 *
 * Value-slice Phase 4 (2026-06-30): Core+ gets non-chain Decision Ledger.
 * The same cryptographic hash + verification ID pipeline runs regardless
 * of tier — only the on-chain call is gated to Verify (enterprise).
 */
export function canUseNonChainLedger(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "starter" || p === "pro" || p === "enterprise";
}

/**
 * Can the user use the non-chain Incident Lock feature (freeze governance
 * state around an incident with tamper-evident hash but no chain anchor)?
 *
 * Value-slice Phase 4 (2026-06-30): Core+ gets non-chain Incident Lock.
 * Verify (enterprise) gets the same feature with on-chain anchoring.
 */
export function canUseNonChainIncidentLock(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "starter" || p === "pro" || p === "enterprise";
}

/**
 * Can the user access on-chain cryptographic anchoring for attestations,
 * incidents, and provenance? This is the Verify moat — should stay
 * Enterprise-only permanently.
 */
export function canUseChainAnchoring(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "enterprise";
}

/**
 * Can this user verify a proof that was sent to them (receive-only)?
 *
 * VALUE-SLICE VIRAL HOOK: Returns true for EVERYONE, including
 * unauthenticated users. Public verification is the Explorer-level viral
 * hook — every attestation a Verify customer issues can be verified by
 * anyone without a Verisum account. Public route lives at /verify/[id]
 * (no auth required, see proxy.ts whitelist).
 *
 * Phase 3 shipped 2026-06-30 — see docs/plans/2026-06-30-value-slice-pricing.md.
 */
export function canVerifyExternalProofs(_plan: string | null | undefined): boolean {
  return true;
}

/**
 * Can the user issue attestations (signed proofs) to third parties?
 * VALUE-SLICE ROADMAP: Assure+ (basic, non-chain), Verify (on-chain).
 */
export function canIssueAttestations(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "pro" || p === "enterprise";
}

/**
 * Can the user export their OWN data (single survey result CSV, own
 * assessment PDF)? Under value-slice, this is true for every tier including
 * Explorer — free tier should give full control of own data.
 *
 * Distinct from `canExportResults()` which historically gated multi-org /
 * bulk export for paid tiers.
 */
export function canExportOwnData(_plan: string | null | undefined): boolean {
  return true;
}

/**
 * Monthly incident-logging quota under value-slice.
 * Aliases {@link maxIncidentsPerMonth} for symmetry with other value-slice
 * helpers; behaviour is identical.
 */
export function getBasicIncidentQuota(plan: string | null | undefined): number {
  return maxIncidentsPerMonth(plan);
}

// ---------------------------------------------------------------------------
// Server-only helpers (use supabaseServer — service role, bypasses RLS)
// ---------------------------------------------------------------------------

import { supabaseServer } from "@/lib/supabase/admin";

/** Fetch the user's plan from the profiles table. Returns "explorer" if missing. */
export async function getUserPlan(userId: string): Promise<PlanName> {
  const db = supabaseServer();
  const { data } = await db
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  return (data?.plan as PlanName) ?? "explorer";
}

/** Count how many survey_runs this user owns. */
export async function getUserSurveyCount(userId: string): Promise<number> {
  const db = supabaseServer();
  const { count } = await db
    .from("survey_runs")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId);

  return count ?? 0;
}

/** Count how many non-archived systems this user owns. */
export async function getUserSystemCount(userId: string): Promise<number> {
  const db = supabaseServer();
  const { count } = await db
    .from("systems")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("archived", false);

  return count ?? 0;
}
