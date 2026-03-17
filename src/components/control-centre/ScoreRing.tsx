"use client";

type ScoreRingProps = {
  score: number | null;
  dimensions?: { label: string; value: number }[];
};

const RADIUS = 38;
const STROKE = 7;
const SIZE = 96;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({ score }: { score: number | null }) {
  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="shrink-0"
      aria-label={score != null ? `Score: ${score}` : "No score"}
    >
      {/* background track */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--border, rgba(0,0,0,0.08))"
        strokeWidth={STROKE}
      />
      {/* filled arc */}
      {score != null && (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--brand, #0066FF)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      )}
      {/* center text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-current text-gray-900"
        style={{ fontSize: score != null ? "22px" : "16px", fontWeight: 700 }}
      >
        {score != null ? score : "--"}
      </text>
    </svg>
  );
}

function DimensionBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 truncate text-xs text-[var(--muted-foreground,#6B7280)]">
        {label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand,#0066FF)] transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold font-mono tabular-nums text-gray-700">
        {value}
      </span>
    </div>
  );
}

export default function ScoreRing({ score, dimensions }: ScoreRingProps) {
  const hasDimensions = dimensions && dimensions.length > 0;

  return (
    <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5">
      {/* header */}
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground,#6B7280)]">
        Verisum Score{" "}
        <span className="font-normal">&middot; TrustOrg composite</span>
      </h3>

      {hasDimensions ? (
        <div className="flex items-start gap-6">
          {/* ring */}
          <Ring score={score} />

          {/* dimension bars */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {dimensions.map((d) => (
              <DimensionBar key={d.label} label={d.label} value={d.value} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <Ring score={score} />
        </div>
      )}
    </div>
  );
}
