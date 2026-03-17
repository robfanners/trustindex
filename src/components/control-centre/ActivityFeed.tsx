"use client";

import Link from "next/link";

type ActivityItem = {
  id: string;
  entity_type: string;
  action_type: string;
  performed_by: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

function ListIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 3h10M2 7h10M2 11h10"
        stroke="var(--brand, #0066FF)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatActionText(item: ActivityItem): string {
  const action = item.action_type.replace(/_/g, " ");
  const entity = item.entity_type.replace(/_/g, " ");
  const capitalised = action.charAt(0).toUpperCase() + action.slice(1);
  const title =
    item.metadata?.title != null ? String(item.metadata.title) : null;
  return title
    ? `${capitalised} ${entity}: ${title}`
    : `${capitalised} ${entity}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");

  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return `${hh}:${mm} \u00B7 Today`;
  }

  const day = d.getDate().toString().padStart(2, "0");
  const mon = d.toLocaleDateString("en-GB", { month: "short" });
  return `${day} ${mon} \u00B7 ${hh}:${mm}`;
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const visible = items.slice(0, 5);

  return (
    <div className="rounded-xl border border-[var(--border,rgba(0,0,0,0.08))] bg-white p-5">
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground,#6B7280)]">
          Recent Activity
        </h3>
        <Link
          href="/actions"
          className="text-xs font-medium text-[var(--brand,#0066FF)] hover:underline"
        >
          All activity
        </Link>
      </div>

      {/* list */}
      {visible.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground,#6B7280)]">
          No recent activity
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              {/* icon */}
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border,rgba(0,0,0,0.08))] bg-gray-50">
                <ListIcon />
              </div>

              {/* content */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-900">
                  {formatActionText(item)}
                </p>
                <span className="text-xs text-[var(--muted-foreground,#6B7280)]">
                  {formatTime(item.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
