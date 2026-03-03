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
