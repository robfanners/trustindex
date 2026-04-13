"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

interface Metric {
  id: string;
  metric_type: string;
  protected_attribute: string;
  group_a: string;
  group_b: string;
  value: number;
  threshold: number;
  passed: boolean;
  sampled_at: string;
}

export default function FairnessPage() {
  return (
    <RequireAuth>
      <AuthenticatedShell>
        <FairnessContent />
      </AuthenticatedShell>
    </RequireAuth>
  );
}

function FairnessContent() {
  const params = useParams();
  const assessmentId = params?.assessmentId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    if (assessmentId) {
      const load = async () => {
        try {
          setLoading(true);
          const res = await fetch("/api/systems/" + assessmentId + "/fairness");
          if (!res.ok) throw new Error("Failed to load");
          const data = await res.json();
          setMetrics(data.metrics || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error");
        } finally {
          setLoading(false);
        }
      };
      load();
    }
  }, [assessmentId]);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-7xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Bias and Fairness Monitoring</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {metrics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No metrics recorded</p>
        </div>
      ) : (
        <table className="w-full text-sm border-collapse border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="border border-gray-300 px-4 py-2 text-left">Type</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Attribute</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Groups</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Value</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2">{m.metric_type}</td>
                <td className="border border-gray-300 px-4 py-2">{m.protected_attribute}</td>
                <td className="border border-gray-300 px-4 py-2">{m.group_a} vs {m.group_b}</td>
                <td className="border border-gray-300 px-4 py-2">{m.value.toFixed(3)}</td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={m.passed ? "text-green-600" : "text-red-600"}>
                    {m.passed ? "PASS" : "FAIL"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
