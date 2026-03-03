"use client";

import TierGate from "@/components/TierGate";
import DeclarationManager from "@/components/monitor/DeclarationManager";

export default function DeclarationsPage() {
  return (
    <TierGate requiredTier="Assure" featureLabel="Staff Declarations">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand/10 text-brand">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2m16 6l2 2 4-4M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
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
