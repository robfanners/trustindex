"use client";

import TierGate from "@/components/TierGate";
import IncidentLog from "@/components/copilot/IncidentLog";
import PageHeader from "@/components/ui/PageHeader";
import OnboardingTour from "@/components/ui/OnboardingTour";

export default function IncidentsPage() {
  return (
    <TierGate requiredTier="Assure" featureLabel="Incidents">
      <div className="space-y-6">
        <div data-tour="page-header">
          <PageHeader
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polygon strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            }
            title="Incidents"
            description="Formal investigations into governance failures — track, resolve, and lock for evidence"
            workflowHint={[
              { label: "Escalations", href: "/monitor/escalations" },
              { label: "Incidents", href: "/monitor/incidents" },
              { label: "Incident Locks", href: "/prove/incident-locks" },
            ]}
          />
        </div>
        <div data-tour="incident-log">
          <IncidentLog />
        </div>

        {/* Onboarding Tour */}
        <OnboardingTour
          tourId="monitor-incidents"
          steps={[
            { target: "[data-tour='page-header']", title: "Incident Log", content: "Track governance failures from detection through resolution. Each incident can be locked for tamper-proof evidence." },
            { target: "[data-tour='incident-log']", title: "Manage Incidents", content: "Create incidents, update their status, and link them to the signals and escalations that triggered them." },
            { target: "[data-tour='workflow-hint']", title: "Create Evidence", content: "Lock resolved incidents to create tamper-proof snapshots for auditors and regulators." },
          ]}
        />
      </div>
    </TierGate>
  );
}
