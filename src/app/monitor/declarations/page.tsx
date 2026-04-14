"use client";

import TierGate from "@/components/TierGate";
import DeclarationManager from "@/components/monitor/DeclarationManager";
import { getCapabilityIcon } from "@/lib/capabilityIcons";

// TG-52 — header icon sourced from the canonical capability registry.
const DeclarationsIcon = getCapabilityIcon("declarations");

export default function DeclarationsPage() {
  return (
    <TierGate requiredTier="Assure" featureLabel="Staff Declarations">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <DeclarationsIcon className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Staff Declarations</h1>
            <p className="text-sm text-muted-foreground">Manage AI usage declaration campaigns</p>
          </div>
        </div>
        <DeclarationManager />
      </div>
    </TierGate>
  );
}
