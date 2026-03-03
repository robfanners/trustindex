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
