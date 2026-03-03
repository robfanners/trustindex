"use client";

import TierGate from "@/components/TierGate";
import IncidentLog from "@/components/copilot/IncidentLog";

export default function IncidentsPage() {
  return (
    <TierGate requiredTier="Assure" featureLabel="Incidents">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polygon strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Incidents</h1>
            <p className="text-sm text-muted-foreground">Log and track AI-related incidents</p>
          </div>
        </div>
        <IncidentLog />
      </div>
    </TierGate>
  );
}
