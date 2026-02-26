// ---------------------------------------------------------------------------
// Assessment Lifecycle — State Machine & Helpers
// ---------------------------------------------------------------------------
// Pure functions defining lifecycle states, transitions, and UI button config
// for both TrustOrg and TrustSys assessments (parity per FILE 2 spec §3).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LifecycleStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "stable"
  | "expired";

export type StabilityStatus = "provisional" | "stable";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "warning";

export type LifecycleButton = {
  label: string;
  action: string;        // machine-readable action key
  variant: ButtonVariant;
  disabled?: boolean;
};

export type LifecycleConfig = {
  status: LifecycleStatus;
  badge: { label: string; className: string };
  buttons: LifecycleButton[];
  warning?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default drift threshold — score delta must exceed this to flag drift */
export const DRIFT_THRESHOLD = 10;

/** Default stability tolerance — variance of last 3 runs must be below this */
export const STABILITY_TOLERANCE = 25;

/** Minimum completed runs required before stability can be achieved */
export const STABILITY_MIN_RUNS = 3;

// ---------------------------------------------------------------------------
// Badge config per status
// ---------------------------------------------------------------------------

const BADGE_CONFIG: Record<LifecycleStatus, { label: string; className: string }> = {
  not_started: {
    label: "Not Started",
    className: "bg-gray-100 text-gray-600",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-brand/10 text-brand",
  },
  completed: {
    label: "Completed",
    className: "bg-success/10 text-success",
  },
  stable: {
    label: "Stable",
    className: "bg-tier-trusted/10 text-tier-trusted",
  },
  expired: {
    label: "Expired",
    className: "bg-destructive/10 text-destructive",
  },
};

// ---------------------------------------------------------------------------
// Stability badge (separate from lifecycle status)
// ---------------------------------------------------------------------------

export function getStabilityBadge(stabilityStatus: StabilityStatus): {
  label: string;
  className: string;
  tooltip: string;
} {
  if (stabilityStatus === "stable") {
    return {
      label: "Stable",
      className: "bg-tier-trusted/10 text-tier-trusted",
      tooltip: "Confidence threshold met — ≥3 consistent runs",
    };
  }
  return {
    label: "Provisional",
    className: "bg-tier-elevated/10 text-tier-elevated",
    tooltip: "Use with caution — fewer than 3 consistent runs",
  };
}

// ---------------------------------------------------------------------------
// Button config per lifecycle state (FILE 2 §3.2)
// ---------------------------------------------------------------------------

function getButtons(
  status: LifecycleStatus,
  context: { type: "trustorg" | "trustsys" }
): LifecycleButton[] {
  const startLabel = context.type === "trustorg" ? "Start Survey" : "Start Assessment";
  const reassessLabel = context.type === "trustorg" ? "Re-Survey" : "Re-Assess";

  switch (status) {
    case "not_started":
      return [
        { label: startLabel, action: "start", variant: "primary" },
      ];

    case "in_progress":
      return [
        { label: "Continue", action: "continue", variant: "primary" },
        { label: "Manage", action: "manage", variant: "secondary" },
        { label: "Delete", action: "delete", variant: "destructive" },
      ];

    case "completed":
      return [
        { label: "View Results", action: "view_results", variant: "primary" },
        { label: reassessLabel, action: "reassess", variant: "secondary" },
        { label: "Manage", action: "manage", variant: "secondary" },
        { label: "History", action: "history", variant: "secondary" },
      ];

    case "stable":
      return [
        { label: "View Results", action: "view_results", variant: "primary" },
        { label: reassessLabel, action: "reassess", variant: "secondary" },
        { label: "History", action: "history", variant: "secondary" },
      ];

    case "expired":
      return [
        { label: reassessLabel, action: "reassess", variant: "warning" },
        { label: "View Results", action: "view_results", variant: "secondary" },
        { label: "History", action: "history", variant: "secondary" },
      ];

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Full lifecycle config for a given status
// ---------------------------------------------------------------------------

export function getLifecycleConfig(
  status: LifecycleStatus,
  type: "trustorg" | "trustsys"
): LifecycleConfig {
  const config: LifecycleConfig = {
    status,
    badge: BADGE_CONFIG[status],
    buttons: getButtons(status, { type }),
  };

  if (status === "expired") {
    config.warning = "Trust status expired. Reassessment required.";
  }

  return config;
}

// ---------------------------------------------------------------------------
// Valid state transitions
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  not_started: ["in_progress"],
  in_progress: ["completed"],
  completed: ["stable", "expired", "in_progress"], // in_progress = re-assess (new run)
  stable: ["expired", "in_progress"],              // in_progress = re-assess (new run)
  expired: ["in_progress"],                        // re-assess only path out
};

export function canTransition(
  from: LifecycleStatus,
  to: LifecycleStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Expiry check
// ---------------------------------------------------------------------------

/**
 * Check if an assessment has expired based on its last completion date
 * and the configured reassessment frequency.
 */
export function isExpired(
  lastCompletedAt: string | Date | null,
  frequencyDays: number | null
): boolean {
  if (!lastCompletedAt || !frequencyDays || frequencyDays <= 0) return false;

  const completed = new Date(lastCompletedAt);
  const dueDate = new Date(completed.getTime() + frequencyDays * 86400000);
  return new Date() > dueDate;
}

/**
 * Days until reassessment is due. Returns null if no frequency set.
 * Negative values mean overdue.
 */
export function daysUntilDue(
  lastCompletedAt: string | Date | null,
  frequencyDays: number | null
): number | null {
  if (!lastCompletedAt || !frequencyDays || frequencyDays <= 0) return null;

  const completed = new Date(lastCompletedAt);
  const dueDate = new Date(completed.getTime() + frequencyDays * 86400000);
  const diff = dueDate.getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

export type DriftResult = {
  hasDrift: boolean;
  delta: number;
  direction: "improved" | "declined" | "none";
  severity: "none" | "moderate" | "significant";
};

/**
 * Calculate drift between current and previous overall scores.
 * Drift is flagged when |delta| > threshold.
 */
export function calculateDrift(
  currentScore: number,
  previousScore: number | null,
  threshold: number = DRIFT_THRESHOLD
): DriftResult {
  if (previousScore === null || previousScore === undefined) {
    return { hasDrift: false, delta: 0, direction: "none", severity: "none" };
  }

  const delta = currentScore - previousScore;
  const absDelta = Math.abs(delta);

  const hasDrift = absDelta > threshold;
  const direction: DriftResult["direction"] =
    delta > 0 ? "improved" : delta < 0 ? "declined" : "none";

  let severity: DriftResult["severity"] = "none";
  if (absDelta > threshold * 1.5) {
    severity = "significant";
  } else if (absDelta > threshold) {
    severity = "moderate";
  }

  return { hasDrift, delta, direction, severity };
}

/**
 * Calculate dimension-level drift. Returns drift per dimension key.
 */
export function calculateDimensionDrift(
  currentScores: Record<string, number>,
  previousScores: Record<string, number> | null,
  threshold: number = DRIFT_THRESHOLD
): Record<string, DriftResult> {
  const result: Record<string, DriftResult> = {};
  if (!previousScores) return result;

  for (const key of Object.keys(currentScores)) {
    result[key] = calculateDrift(
      currentScores[key],
      previousScores[key] ?? null,
      threshold
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stability heuristic (FILE 2 §7)
// ---------------------------------------------------------------------------

/**
 * Determine if an assessment has achieved stability.
 * Requires ≥3 completed runs AND variance of last 3 scores < tolerance.
 */
export function checkStability(
  completedScores: number[],
  tolerance: number = STABILITY_TOLERANCE,
  minRuns: number = STABILITY_MIN_RUNS
): { isStable: boolean; variance: number | null } {
  if (completedScores.length < minRuns) {
    return { isStable: false, variance: null };
  }

  // Take the last `minRuns` scores
  const recent = completedScores.slice(-minRuns);
  const mean = recent.reduce((sum, s) => sum + s, 0) / recent.length;
  const variance =
    recent.reduce((sum, s) => sum + (s - mean) ** 2, 0) / recent.length;

  return {
    isStable: variance < tolerance,
    variance: Math.round(variance * 100) / 100,
  };
}
