// src/lib/capabilityIcons.ts
//
// TG-52 — Single source of truth for capability icons.
//
// Every capability (nav item, module card, page header, breadcrumb) MUST pull
// its icon from this registry. Raw <svg> in module pages is blocked by the
// ESLint `no-restricted-syntax` rule in eslint.config.mjs.
//
// Rob's explicit preferences:
//   - Drift & Alerts uses `Activity` (pure ECG waveform). NOT HeartPulse
//     (which renders as a heart at 16px — he hates this).
//
// When adding a new capability:
//   1. Add a key here and a Lucide icon
//   2. Reference the same key from `src/lib/navigation.ts` (NavItem.icon)
//   3. The smoke test in __tests__/capabilityIcons.test.ts will enforce coverage

import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileText,
  Gavel,
  GitBranch,
  Home,
  KeyRound,
  LayoutDashboard,
  Link2,
  Lock,
  Radio,
  Search,
  Server,
  Settings as SettingsIcon,
  ScrollText,
  Share2,
  ShieldCheck,
  Stamp,
  UserCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Canonical registry. Keys are slug-friendly capability identifiers
 * referenced from navigation.ts and from page components.
 */
export const CAPABILITY_ICONS = {
  // Overview / chrome
  home: Home,
  "layout-dashboard": LayoutDashboard,
  settings: SettingsIcon,
  lock: Lock,
  key: KeyRound,
  clipboard: ClipboardCheck,

  // GOVERN
  trustgraph: GitBranch,
  policies: ScrollText,
  "ai-registry": Server,
  vendors: Building2,
  models: Cpu,
  regulation: Gavel,
  actions: CheckCircle2,

  // MONITOR
  "drift-alerts": Activity, // ECG waveform (Rob's pick)
  escalations: AlertTriangle,
  incidents: Zap,
  declarations: UserCheck,
  signals: Radio,

  // PROVE
  approvals: ShieldCheck,
  attestations: Stamp,
  provenance: Link2,
  decisions: FileText,
  "incident-lock": Lock,
  "trust-exchange": Share2,
  verification: Search,

  // REPORT
  reports: FileText,
} as const;

export type CapabilityKey = keyof typeof CAPABILITY_ICONS;

/**
 * Lookup with compile-time guarantee the key exists.
 * Prefer `getCapabilityIcon("drift-alerts")` over direct map access.
 */
export function getCapabilityIcon(key: CapabilityKey): LucideIcon {
  return CAPABILITY_ICONS[key];
}

/**
 * Legacy-alias lookup used by sidebar / navigation.ts where icon strings
 * are not necessarily CapabilityKey. Falls back to null if unknown.
 */
export function resolveIcon(key: string): LucideIcon | null {
  return (CAPABILITY_ICONS as Record<string, LucideIcon>)[key] ?? null;
}
