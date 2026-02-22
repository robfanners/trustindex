import { getTierForScore, type TierKey, getTierConfig } from "@/lib/trustGraphTiers";

type TierBadgeProps =
  | { score: number; tier?: never }
  | { tier: TierKey; score?: never };

export default function TierBadge(props: TierBadgeProps) {
  const config = "tier" in props && props.tier
    ? getTierConfig(props.tier)
    : getTierForScore(props.score!);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.colorClass} ${config.bgClass}`}
    >
      {config.label}
    </span>
  );
}
