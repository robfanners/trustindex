"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

type TimelinePoint = {
  date: string;
  org_score: number | null;
  avg_sys_score: number | null;
  drift_events_count: number;
};

type TrendsData = {
  timeline: TimelinePoint[];
  period_days: number;
};

export default function TrustTrends({ days = 90 }: { days?: number }) {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trustgraph/trends?days=${days}`)
      .then((r) => r.json())
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="animate-pulse h-64 bg-muted/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm">
        Loading trends...
      </div>
    );
  }

  if (!data || data.timeline.length === 0) {
    return (
      <div className="h-64 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm">
        No score history yet. Complete assessments to see trends.
      </div>
    );
  }

  const chartData = data.timeline.map((point) => ({
    ...point,
    date: new Date(point.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Trust Score Trends</h3>
        <span className="text-xs text-muted-foreground">Last {days} days</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={65} stroke="#2563eb" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={50} stroke="#d97706" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Line
            type="monotone"
            dataKey="org_score"
            name="Org Score"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="avg_sys_score"
            name="Avg System Score"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
