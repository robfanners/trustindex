// TG-52 — smoke test for the capability-icon registry.
//
// Guarantees:
//   1. Every icon key referenced from navigation.ts resolves to a Lucide
//      component via the registry.
//   2. Drift & Alerts uses `Activity` (ECG waveform) — Rob's explicit pick.
//      Any change away from this must be a deliberate ticket, not a drift.
//   3. `resolveIcon` returns null for unknown keys (no silent fallback).

import { describe, it, expect } from "vitest";
import { Activity } from "lucide-react";
import {
  CAPABILITY_ICONS,
  getCapabilityIcon,
  resolveIcon,
  type CapabilityKey,
} from "@/lib/capabilityIcons";
import { navSections } from "@/lib/navigation";

describe("capabilityIcons registry", () => {
  it("resolves every nav icon key", () => {
    const missing: string[] = [];
    for (const section of navSections) {
      for (const item of section.items) {
        if (!resolveIcon(item.icon)) {
          missing.push(`${section.id}/${item.label} → "${item.icon}"`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("uses Activity (ECG waveform) for drift-alerts — NOT HeartPulse", () => {
    // Rob hates the heart-shaped HeartPulse at small sizes. This test
    // exists so a well-meaning refactor can't silently swap it back.
    expect(getCapabilityIcon("drift-alerts")).toBe(Activity);
  });

  it("returns null from resolveIcon() for unknown keys", () => {
    expect(resolveIcon("totally-not-a-capability")).toBeNull();
  });

  it("all registry keys map to defined Lucide components", () => {
    const keys = Object.keys(CAPABILITY_ICONS) as CapabilityKey[];
    for (const key of keys) {
      expect(CAPABILITY_ICONS[key]).toBeDefined();
    }
  });
});
