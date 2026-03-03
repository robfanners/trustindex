# Phase 1: Navigation Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat 6-item sidebar navigation with the workflow-based Govern / Monitor / Prove / Report / Settings structure, with tier-gated sections for Monitor (Assure) and Prove (Verify).

**Architecture:** The sidebar in `AuthenticatedShell.tsx` is rewritten to render grouped navigation sections with headers. Each section has a `minTier` requirement checked against `profile.plan`. Locked sections show nav items in a dimmed state with a lock icon and tier badge. New placeholder route pages are created under `/monitor/` and `/prove/` for items that don't have routes yet.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, inline SVGs (no icon library in this codebase)

---

## Task 1: Create Navigation Configuration

**Files:**
- Create: `src/lib/navigation.ts`

**Step 1: Create the navigation config file**

This file defines the full nav structure, tier requirements, and icon identifiers. It's the single source of truth for all navigation rendering.

```typescript
// src/lib/navigation.ts

import type { PlanName } from "@/lib/entitlements";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  /** If true, this item links to an existing page. If false, it's a new placeholder. */
  exists: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  /** Minimum plan tier required to access this section. null = available to all. */
  minTier: PlanName | null;
  /** Tier badge text shown when locked (e.g., "Assure", "Verify") */
  tierBadge?: string;
  items: NavItem[];
};

/** Ordered plan tiers from lowest to highest */
const TIER_ORDER: PlanName[] = ["explorer", "starter", "pro", "enterprise"];

/** Check if a user's plan meets the minimum tier requirement */
export function meetsMinTier(userPlan: string | null | undefined, minTier: PlanName | null): boolean {
  if (!minTier) return true;
  const userIdx = TIER_ORDER.indexOf((userPlan ?? "explorer") as PlanName);
  const minIdx = TIER_ORDER.indexOf(minTier);
  return userIdx >= minIdx;
}

/**
 * Map current plans to Verisum tiers:
 * explorer/starter → Core
 * pro → Assure
 * enterprise → Verify
 */
export function getTierName(plan: string | null | undefined): string {
  const p = plan ?? "explorer";
  if (p === "enterprise") return "Verify";
  if (p === "pro") return "Assure";
  return "Core";
}

export const navSections: NavSection[] = [
  {
    id: "overview",
    label: "",
    minTier: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "home", exists: true },
    ],
  },
  {
    id: "govern",
    label: "GOVERN",
    minTier: null,
    items: [
      { label: "TrustOrg", href: "/trustorg", icon: "clipboard", exists: true },
      { label: "TrustSys", href: "/trustsys", icon: "cpu", exists: true },
      { label: "Policies", href: "/copilot/generate-policy", icon: "scroll", exists: true },
      { label: "Actions", href: "/actions", icon: "check-circle", exists: true },
    ],
  },
  {
    id: "monitor",
    label: "MONITOR",
    minTier: "pro",
    tierBadge: "Assure",
    items: [
      { label: "Drift & Alerts", href: "/monitor/drift", icon: "activity", exists: false },
      { label: "Escalations", href: "/monitor/escalations", icon: "alert-triangle", exists: false },
      { label: "Incidents", href: "/monitor/incidents", icon: "zap", exists: false },
      { label: "Declarations", href: "/monitor/declarations", icon: "user-check", exists: false },
    ],
  },
  {
    id: "prove",
    label: "PROVE",
    minTier: "enterprise",
    tierBadge: "Verify",
    items: [
      { label: "Approvals", href: "/prove/approvals", icon: "shield-check", exists: false },
      { label: "Attestations", href: "/prove/attestations", icon: "stamp", exists: false },
      { label: "Provenance", href: "/prove/provenance", icon: "link", exists: false },
      { label: "Verification", href: "/prove/verification", icon: "search", exists: false },
    ],
  },
  {
    id: "report",
    label: "REPORT",
    minTier: null,
    items: [
      { label: "Reports", href: "/reports", icon: "file-text", exists: true },
    ],
  },
  {
    id: "settings",
    label: "SETTINGS",
    minTier: null,
    items: [
      { label: "Settings", href: "/dashboard/settings", icon: "settings", exists: true },
    ],
  },
];
```

**Step 2: Verify file created**

Run: `ls -la src/lib/navigation.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add src/lib/navigation.ts
git commit -m "feat: add navigation configuration with tier-gated sections"
```

---

## Task 2: Add New Icon SVGs to AuthenticatedShell

**Files:**
- Modify: `src/components/AuthenticatedShell.tsx` (lines 30-73, the `NavIcon` component)

**Step 1: Extend the NavIcon switch statement**

Add cases for new icons needed by the Monitor and Prove sections. The existing icons (home, clipboard, cpu, check-circle, file-text, settings) stay unchanged. Add these new cases inside the `NavIcon` function:

```typescript
    case "scroll":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
        </svg>
      );
    case "activity":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "alert-triangle":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
        </svg>
      );
    case "zap":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polygon strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "user-check":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2m16 6l2 2 4-4M12.5 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "shield-check":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
        </svg>
      );
    case "stamp":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 21h14M12 17V9m-3 8h6l1-4H8l1 4zM9 9a3 3 0 116 0" />
        </svg>
      );
    case "link":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      );
    case "search":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle strokeWidth={1.5} cx="11" cy="11" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35" />
        </svg>
      );
    case "lock":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      );
```

**Step 2: Commit**

```bash
git add src/components/AuthenticatedShell.tsx
git commit -m "feat: add SVG icons for Monitor and Prove navigation sections"
```

---

## Task 3: Rewrite Sidebar Navigation Rendering

**Files:**
- Modify: `src/components/AuthenticatedShell.tsx`

This is the main change. Replace the flat `navLinks.map()` with grouped sections that render section headers and tier-locked states.

**Step 1: Add imports at the top of the file**

After the existing imports (line 13), add:

```typescript
import { navSections, meetsMinTier, getTierName } from "@/lib/navigation";
```

**Step 2: Remove the old `navLinks` constant**

Delete lines 21-28 (the `const navLinks = [...]` array). It's replaced by `navSections` from the config.

**Step 3: Update the `activeNav` logic**

Replace the current `activeNav` useMemo (lines 104-115) with:

```typescript
  const activeNav = useMemo(() => {
    // Exact matches first
    if (pathname.startsWith("/dashboard/settings")) return "/dashboard/settings";
    if (pathname === "/dashboard") return "/dashboard";
    // Section routes
    if (pathname.startsWith("/trustorg")) return "/trustorg";
    if (pathname.startsWith("/trustsys")) return "/trustsys";
    if (pathname.startsWith("/actions")) return "/actions";
    if (pathname.startsWith("/reports")) return "/reports";
    if (pathname.startsWith("/copilot")) return "/copilot/generate-policy";
    if (pathname.startsWith("/monitor")) return pathname;
    if (pathname.startsWith("/prove")) return pathname;
    // Legacy routes
    if (pathname.startsWith("/dashboard/surveys")) return "/trustorg";
    if (pathname.startsWith("/systems")) return "/trustsys";
    return pathname;
  }, [pathname]);
```

**Step 4: Replace the `<nav>` element contents**

Replace the `<nav>` block (currently lines 202-227) with the grouped section renderer:

```tsx
          <nav className={`flex-1 py-3 overflow-y-auto ${sidebarCollapsed ? "lg:px-1.5" : "px-3"}`}>
            {navSections.map((section) => {
              const isLocked = !meetsMinTier(profile?.plan, section.minTier);

              return (
                <div key={section.id} className={section.label ? "mt-5 first:mt-0" : ""}>
                  {/* Section header */}
                  {section.label && !sidebarCollapsed && (
                    <div className="flex items-center justify-between px-3 mb-1">
                      <span className={`text-[10px] font-semibold tracking-widest ${
                        isLocked ? "text-muted-foreground/50" : "text-muted-foreground"
                      }`}>
                        {section.label}
                      </span>
                      {isLocked && section.tierBadge && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">
                          {section.tierBadge}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Collapsed section indicator */}
                  {section.label && sidebarCollapsed && (
                    <div className="hidden lg:flex justify-center my-2">
                      <div className={`w-5 h-px ${isLocked ? "bg-border/50" : "bg-border"}`} />
                    </div>
                  )}

                  {/* Nav items */}
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = activeNav === item.href;
                      const href = isLocked ? "#" : item.href;

                      return (
                        <Link
                          key={item.href}
                          href={href}
                          title={sidebarCollapsed ? item.label : undefined}
                          onClick={(e) => {
                            if (isLocked) {
                              e.preventDefault();
                              // Will be replaced by upgrade modal in Phase 2
                              return;
                            }
                            setSidebarOpen(false);
                          }}
                          className={`
                            flex items-center gap-3 py-2 rounded-lg text-sm transition-all
                            ${sidebarCollapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}
                            ${isLocked
                              ? "text-muted-foreground/40 cursor-default"
                              : isActive
                                ? "bg-brand/10 text-brand font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }
                          `}
                        >
                          <NavIcon icon={isLocked ? item.icon : item.icon} />
                          <span className={sidebarCollapsed ? "lg:hidden" : ""}>
                            {item.label}
                          </span>
                          {isLocked && !sidebarCollapsed && (
                            <NavIcon icon="lock" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
```

**Step 5: Access profile in the component**

Update the component to destructure `profile` from `useAuth()`. Change line 77 from:

```typescript
  useAuth(); // ensure auth context is available for header components
```

to:

```typescript
  const { profile } = useAuth();
```

**Step 6: Verify the app builds**

Run: `cd ~/trustindex && npm run build`
Expected: Build succeeds (or only unrelated warnings)

**Step 7: Commit**

```bash
git add src/components/AuthenticatedShell.tsx
git commit -m "feat: restructure sidebar into Govern/Monitor/Prove/Report workflow sections"
```

---

## Task 4: Update ModuleSwitcher

**Files:**
- Modify: `src/components/header/ModuleSwitcher.tsx`

**Step 1: Rewrite to use navigation config**

Replace the entire file contents:

```typescript
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { navSections, meetsMinTier } from "@/lib/navigation";

export default function ModuleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Flatten accessible items for the switcher
  const accessibleItems = navSections
    .filter((s) => meetsMinTier(profile?.plan, s.minTier))
    .flatMap((s) => s.items)
    .filter((item) => item.href !== "/dashboard" && item.href !== "/dashboard/settings");

  const current = accessibleItems.find(
    (m) =>
      pathname.startsWith(m.href) ||
      (m.href === "/trustorg" && pathname.startsWith("/dashboard/surveys"))
  );

  return (
    <div className="relative hidden sm:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        {current?.label ?? "Modules"}
        <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-52 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
          {accessibleItems.map((m) => {
            const active = pathname.startsWith(m.href);
            return (
              <button
                key={m.href}
                onClick={() => { router.push(m.href); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  active ? "bg-brand/10 text-brand font-medium" : "text-foreground hover:bg-muted"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/header/ModuleSwitcher.tsx
git commit -m "feat: update ModuleSwitcher to use navigation config with tier filtering"
```

---

## Task 5: Create Monitor Placeholder Pages

**Files:**
- Create: `src/app/monitor/drift/page.tsx`
- Create: `src/app/monitor/escalations/page.tsx`
- Create: `src/app/monitor/incidents/page.tsx`
- Create: `src/app/monitor/declarations/page.tsx`
- Create: `src/app/monitor/layout.tsx`

**Step 1: Create the Monitor layout**

```typescript
// src/app/monitor/layout.tsx
import AuthenticatedShell from "@/components/AuthenticatedShell";

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
```

**Step 2: Create a reusable placeholder component**

```typescript
// src/components/TierPlaceholder.tsx
"use client";

import Link from "next/link";

type TierPlaceholderProps = {
  title: string;
  description: string;
  tierName: string;
  icon: React.ReactNode;
};

export default function TierPlaceholder({ title, description, tierName, icon }: TierPlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-brand/10 text-brand">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand/10 text-brand">
            {tierName}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground max-w-xl">{description}</p>
      <div className="border border-dashed border-border rounded-xl p-12 text-center space-y-4">
        <div className="text-muted-foreground/60">
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect strokeWidth={1.5} x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <p className="text-sm font-medium">Available on Verisum {tierName}</p>
          <p className="text-xs mt-1">Upgrade your plan to unlock this capability</p>
        </div>
        <Link
          href="/upgrade"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
        >
          View Plans
        </Link>
      </div>
    </div>
  );
}
```

**Step 3: Create the four Monitor pages**

```typescript
// src/app/monitor/drift/page.tsx
import TierPlaceholder from "@/components/TierPlaceholder";

export default function DriftPage() {
  return (
    <TierPlaceholder
      title="Drift & Alerts"
      description="Monitor your AI systems for governance drift. Get alerted when systems deviate from declared risk thresholds, autonomy boundaries, or control baselines."
      tierName="Assure"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      }
    />
  );
}
```

```typescript
// src/app/monitor/escalations/page.tsx
import TierPlaceholder from "@/components/TierPlaceholder";

export default function EscalationsPage() {
  return (
    <TierPlaceholder
      title="Escalations"
      description="Auto-triggered escalation workflows when human intervention is required. Route approvals based on IBG conditions, risk severity, and decision rights."
      tierName="Assure"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
        </svg>
      }
    />
  );
}
```

```typescript
// src/app/monitor/incidents/page.tsx
import TierPlaceholder from "@/components/TierPlaceholder";

export default function IncidentsPage() {
  return (
    <TierPlaceholder
      title="Incidents"
      description="Log, track, and resolve AI-related incidents. Capture impact levels, link to vendors, and maintain a complete resolution timeline."
      tierName="Assure"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <polygon strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      }
    />
  );
}
```

```typescript
// src/app/monitor/declarations/page.tsx
import TierPlaceholder from "@/components/TierPlaceholder";

export default function DeclarationsPage() {
  return (
    <TierPlaceholder
      title="Staff Declarations"
      description="Collect and manage staff AI usage declarations. Track which tools your teams are using, what data types are involved, and ensure visibility across the organisation."
      tierName="Assure"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2m16 6l2 2 4-4M12.5 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      }
    />
  );
}
```

**Step 4: Commit**

```bash
git add src/app/monitor/ src/components/TierPlaceholder.tsx
git commit -m "feat: add Monitor section placeholder pages (drift, escalations, incidents, declarations)"
```

---

## Task 6: Create Prove Placeholder Pages

**Files:**
- Create: `src/app/prove/approvals/page.tsx`
- Create: `src/app/prove/attestations/page.tsx`
- Create: `src/app/prove/provenance/page.tsx`
- Create: `src/app/prove/verification/page.tsx`
- Create: `src/app/prove/layout.tsx`

**Step 1: Create the Prove layout**

```typescript
// src/app/prove/layout.tsx
import AuthenticatedShell from "@/components/AuthenticatedShell";

export default function ProveLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
```

**Step 2: Create the four Prove pages**

```typescript
// src/app/prove/approvals/page.tsx
import TierPlaceholder from "@/components/TierPlaceholder";

export default function ApprovalsPage() {
  return (
    <TierPlaceholder
      title="Approval Inbox"
      description="Review and cryptographically sign high-risk AI actions. Each approval is bound to your verified identity, the system state, and risk classification — creating tamper-resistant proof of human oversight."
      tierName="Verify"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
        </svg>
      }
    />
  );
}
```

```typescript
// src/app/prove/attestations/page.tsx
import TierPlaceholder from "@/components/TierPlaceholder";

export default function AttestationsPage() {
  return (
    <TierPlaceholder
      title="Attestations"
      description="Build and issue signed governance attestations for regulators, board members, and partners. Generate portable verification IDs that can be independently validated."
      tierName="Verify"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 21h14M12 17V9m-3 8h6l1-4H8l1 4zM9 9a3 3 0 116 0" />
        </svg>
      }
    />
  );
}
```

```typescript
// src/app/prove/provenance/page.tsx
import TierPlaceholder from "@/components/TierPlaceholder";

export default function ProvenancePage() {
  return (
    <TierPlaceholder
      title="Provenance Certificates"
      description="Generate verifiable chain-of-custody records for AI outputs. Bind model version, prompt classification, data sources, and human reviewer into a cryptographic proof of origin."
      tierName="Verify"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      }
    />
  );
}
```

```typescript
// src/app/prove/verification/page.tsx
import TierPlaceholder from "@/components/TierPlaceholder";

export default function VerificationPage() {
  return (
    <TierPlaceholder
      title="Verification Portal"
      description="Validate governance proofs, verify attestation signatures, and confirm on-chain anchoring. Share verification links with external parties for independent trust validation."
      tierName="Verify"
      icon={
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle strokeWidth={1.5} cx="11" cy="11" r="8" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35" />
        </svg>
      }
    />
  );
}
```

**Step 3: Commit**

```bash
git add src/app/prove/
git commit -m "feat: add Prove section placeholder pages (approvals, attestations, provenance, verification)"
```

---

## Task 7: Add Monitor and Prove Routes to Middleware

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Read the current middleware to find the protected routes list**

Read `src/middleware.ts` and find where routes like `/dashboard`, `/trustorg`, `/trustsys` etc. are listed as protected.

**Step 2: Add `/monitor` and `/prove` to the protected routes**

Add both `/monitor` and `/prove` path prefixes to the same protection list that includes `/dashboard`, `/trustorg`, `/trustsys`, `/actions`, `/reports`.

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: protect /monitor and /prove routes with auth middleware"
```

---

## Task 8: Verify End-to-End

**Step 1: Run the dev server**

Run: `cd ~/trustindex && npm run dev`

**Step 2: Visual verification checklist**

Log into the app and verify:

- [ ] Sidebar shows grouped sections: (no label for Dashboard), GOVERN, MONITOR, PROVE, REPORT, SETTINGS
- [ ] GOVERN section shows: TrustOrg, TrustSys, Policies, Actions
- [ ] MONITOR section shows with "Assure" tier badge (locked for explorer/starter plans)
- [ ] PROVE section shows with "Verify" tier badge (locked for explorer/starter/pro plans)
- [ ] Locked items are dimmed with lock icons
- [ ] Clicking locked items does nothing (no navigation)
- [ ] All existing routes still work: /dashboard, /trustorg, /trustsys, /actions, /reports, /dashboard/settings
- [ ] Active state highlighting works for all existing routes
- [ ] Sidebar collapse/expand still works (including section headers hiding when collapsed)
- [ ] Mobile sidebar overlay still works
- [ ] ModuleSwitcher dropdown shows accessible items only (no locked items)
- [ ] Navigating to /monitor/drift (if plan allows, or directly via URL) shows the placeholder page

**Step 3: Run build**

Run: `cd ~/trustindex && npm run build`
Expected: Build succeeds

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address navigation restructure issues found during verification"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|----------------|
| 1 | Navigation configuration | `src/lib/navigation.ts` | — |
| 2 | New icon SVGs | — | `AuthenticatedShell.tsx` |
| 3 | Sidebar section rendering | — | `AuthenticatedShell.tsx` |
| 4 | ModuleSwitcher update | — | `ModuleSwitcher.tsx` |
| 5 | Monitor placeholder pages | 6 files in `src/app/monitor/` + `TierPlaceholder.tsx` | — |
| 6 | Prove placeholder pages | 5 files in `src/app/prove/` | — |
| 7 | Auth middleware update | — | `middleware.ts` |
| 8 | End-to-end verification | — | — |
