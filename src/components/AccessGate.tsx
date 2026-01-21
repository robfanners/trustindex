"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AccessGate() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = (searchParams.get("role") || "verisum") as "verisum" | "owner";
  const next = searchParams.get("next") || "/admin";
  const runId = searchParams.get("runId") || "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (role === "owner") return "Enter admin code";
    return "Verisum admin access";
  }, [role]);

  const hint = useMemo(() => {
    if (role === "owner") return "Enter the admin code you were given when you created the survey.";
    return "Enter the Verisum admin code.";
  }, [role]);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      if (role === "owner") {
        if (!runId) {
          setError("Missing run id.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/auth-owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, token: code }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Access denied");
        router.push(next);
        return;
      }

      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Access denied");
      router.push(next);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto border rounded-lg p-6 space-y-4 bg-white">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-gray-600">{hint}</p>
      </div>

      <div className="space-y-2">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="button"
          className="w-full px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={loading || !code.trim()}
          onClick={submit}
        >
          {loading ? "Checking…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
