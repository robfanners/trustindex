/**
 * Plan entitlements — single source of truth for all plan-based limits.
 *
 * Pure functions at the top are safe for client + server use.
 * Server-only helpers (DB queries) are at the bottom and import supabaseServer.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanName = "explorer" | "pro" | "enterprise";

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
  pro: { maxSurveys: 5, maxSystems: 2, canExport: true },
  enterprise: { maxSurveys: Infinity, maxSystems: Infinity, canExport: true },
};

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
