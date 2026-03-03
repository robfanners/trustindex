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
