"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegulatoryUpdate = {
  id: string;
  title: string;
  summary: string;
  source_url: string | null;
  jurisdictions: string[];
  sector_tags: string[];
  published_at: string;
};

type JurisdictionFilter = "all" | "uk" | "eu";

const JURISDICTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  uk: { label: "UK", color: "text-blue-700", bg: "bg-blue-50" },
  eu: { label: "EU", color: "text-amber-700", bg: "bg-amber-50" },
  international: { label: "International", color: "text-purple-700", bg: "bg-purple-50" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegulatoryFeed() {
  const [updates, setUpdates] = useState<RegulatoryUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<JurisdictionFilter>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = filter !== "all" ? `?jurisdiction=${filter}` : "";
        const res = await fetch(`/api/regulatory${params}`);
        if (res.ok) {
          const data = await res.json();
          setUpdates(data.updates ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filter]);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "uk", "eu"] as JurisdictionFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              filter === f
                ? "bg-brand text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All" : f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading updates...
        </div>
      )}

      {/* Empty state */}
      {!loading && updates.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          No regulatory updates found for this filter.
        </p>
      )}

      {/* Timeline */}
      {!loading && updates.length > 0 && (
        <div className="space-y-3">
          {updates.map((update) => (
            <div
              key={update.id}
              className="border border-border rounded-lg p-4 hover:border-brand/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {update.jurisdictions.map((j) => {
                      const style = JURISDICTION_LABELS[j] || {
                        label: j,
                        color: "text-gray-600",
                        bg: "bg-gray-50",
                      };
                      return (
                        <span
                          key={j}
                          className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}
                        >
                          {style.label}
                        </span>
                      );
                    })}
                    {update.sector_tags.length > 0 &&
                      update.sector_tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                  <h4 className="text-sm font-medium text-foreground">{update.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {update.summary}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(update.published_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              {update.source_url && (
                <a
                  href={update.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-brand hover:text-brand/80 mt-2 transition-colors"
                >
                  View source &rarr;
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
