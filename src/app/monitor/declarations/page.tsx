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
