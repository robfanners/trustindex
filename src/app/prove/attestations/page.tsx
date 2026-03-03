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
