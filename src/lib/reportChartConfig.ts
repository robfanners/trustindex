// ---------------------------------------------------------------------------
// Shared Recharts colour palette and config for reports
// ---------------------------------------------------------------------------
// Uses CSS variable hex values from globals.css for consistency.

export const CHART_COLORS = {
  brand: "#3496da",
  success: "#00C851",
  warning: "#FF8C00",
  destructive: "#d4183d",
  muted: "#94a3b8",
  teal: "#0d9488",
  coral: "#e8614d",
  // Tier colours
  trusted: "#16a34a",
  stable: "#2563eb",
  elevated: "#d97706",
  critical: "#dc2626",
} as const;

/** Severity → colour mapping for charts */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: CHART_COLORS.destructive,
  high: CHART_COLORS.coral,
  medium: CHART_COLORS.warning,
  low: CHART_COLORS.muted,
};

/** Status → colour mapping for charts */
export const STATUS_COLORS: Record<string, string> = {
  open: CHART_COLORS.warning,
  in_progress: CHART_COLORS.brand,
  blocked: CHART_COLORS.destructive,
  done: CHART_COLORS.success,
};

/** Default chart tooltip styling */
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "12px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
  },
  labelStyle: {
    fontWeight: 600,
    marginBottom: "4px",
  },
};

/** Default responsive container height */
export const CHART_HEIGHT = 300;
export const CHART_HEIGHT_SM = 220;
