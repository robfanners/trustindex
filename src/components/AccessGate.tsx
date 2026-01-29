"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Helper to validate that next path is safe (internal, no open redirects)
function isSafePath(path: string): boolean {
  if (!path || !path.startsWith("/")) return false;
  if (path.startsWith("http") || path.includes("://")) return false;
  return true;
}

export default function AccessGate() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = (searchParams.get("role") || "verisum") as "verisum" | "owner";
  const nextParam = searchParams.get("next");
  // For verisum role, default to /admin/new-run; for owner, use provided next or default
  const next = role === "verisum" 
    ? (nextParam && isSafePath(nextParam) ? nextParam : "/admin/new-run")
    : (nextParam && isSafePath(nextParam) ? nextParam : "/admin/new-run");
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
        body: JSON.stringify({ code, role: "verisum", next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Access denied");
      // Use the next from response if provided, otherwise use our computed next
      const redirectTo = (json?.next && isSafePath(json.next)) ? json.next : next;
      router.push(redirectTo);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto border border-verisum-grey rounded-lg p-4 md:p-6 space-y-4 bg-verisum-white">
      <div className="space-y-1">
        <h2 className="text-lg md:text-xl font-semibold">{title}</h2>
        <p className="text-sm text-verisum-grey">{hint}</p>
      </div>

      <div className="space-y-2">
        <input
          className="w-full border border-verisum-grey rounded px-3 py-2 min-h-[44px]"
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {error && <div className="text-sm text-verisum-red">{error}</div>}
        <button
          type="button"
          className="w-full px-4 py-2 rounded bg-verisum-blue text-verisum-white disabled:opacity-50 hover:bg-[#2a7bb8] min-h-[44px]"
          disabled={loading || !code.trim()}
          onClick={submit}
        >
          {loading ? "Checking…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
