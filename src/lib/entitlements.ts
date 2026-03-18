/**
 * Plan entitlements — single source of truth for all plan-based limits.
 *
 * Pure functions at the top are safe for client + server use.
 * Server-only helpers (DB queries) are at the bottom and import supabaseServer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanName = "explorer" | "starter" | "pro" | "enterprise";

export type PlanLimits = {
  maxSurveys: number; // Infinity for enterprise
  maxSystems: number; // Infinity for enterprise
  canExport: boolean;
};

// ---------------------------------------------------------------------------
// Pure helpers (client + server safe)
// ---------------------------------------------------------------------------

const LIMITS: Record<PlanName, PlanLimits> = {
  explorer: { maxSurveys: 1, maxSystems: 0, canExport: false },
  starter: { maxSurveys: 1, maxSystems: 0, canExport: false },
  pro: { maxSurveys: 5, maxSystems: 2, canExport: true },
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

/** Can the user access data & export settings? (Pro+) */
export function canAccessDataSettings(plan: string | null | undefined): boolean {
  const p = plan ?? "explorer";
  return p === "pro" || p === "enterprise";
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
// Server-only helpers (use supabaseServer — service role, bypasses RLS)
// ---------------------------------------------------------------------------

import { supabaseServer } from "@/lib/supabaseServer";

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
