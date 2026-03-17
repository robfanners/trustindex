"use client";

import Link from "next/link";

type RegUpdate = {
  id: string;
  title: string;
  jurisdictions: string[];
  published_at: string;
};

const JURISDICTION_STYLES: Record<string, string> = {
  EU: "bg-green-50 text-green-900",
  UK: "bg-blue-50 text-blue-900",
};

function JurisdictionBadge({ code }: { code: string }) {
  const style =
    JURISDICTION_STYLES[code] ?? "bg-gray-50 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none ${style}`}
    >
      {code}
    </span>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export default function RegFeedCard({ updates }: { updates: RegUpdate[] }) {
  const visible = updates.slice(0, 3);

  return (
    <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5">
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground,#6B7280)]">
            Regulatory Feed
          </h3>
          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold leading-none text-gray-600">
            {updates.length}
          </span>
        </div>
        <Link
          href="/copilot/generate-policy"
          className="text-xs font-medium text-[var(--brand,#0066FF)] hover:underline"
        >
          All updates
        </Link>
      </div>

      {/* list */}
      {visible.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground,#6B7280)]">
          No regulatory updates
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              {/* jurisdiction badges */}
              <div className="flex shrink-0 gap-1">
                {u.jurisdictions.map((j) => (
                  <JurisdictionBadge key={j} code={j} />
                ))}
              </div>

              {/* title */}
              <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                {u.title}
              </span>

              {/* date */}
              <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground,#6B7280)]">
                {formatShortDate(u.published_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
