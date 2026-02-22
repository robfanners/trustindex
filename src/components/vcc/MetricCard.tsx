"use client";

type MetricCardProps = {
  label: string;
  value: string | number;
  /** Optional sub-label shown below the value */
  sub?: string;
  /** Optional colour accent: "blue" | "green" | "amber" | "red" | "gray" */
  accent?: "blue" | "green" | "amber" | "red" | "gray";
};

const accentStyles: Record<string, string> = {
  blue: "border-l-blue-500 bg-blue-50",
  green: "border-l-green-500 bg-green-50",
  amber: "border-l-amber-500 bg-amber-50",
  red: "border-l-red-500 bg-red-50",
  gray: "border-l-gray-400 bg-gray-50",
};

const valueColors: Record<string, string> = {
  blue: "text-blue-700",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  gray: "text-gray-700",
};

export default function MetricCard({
  label,
  value,
  sub,
  accent = "gray",
}: MetricCardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 border-l-4 p-4 ${accentStyles[accent] ?? accentStyles.gray}`}
    >
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${valueColors[accent] ?? valueColors.gray}`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {sub && (
        <div className="text-xs text-gray-500 mt-1">{sub}</div>
      )}
    </div>
  );
}
