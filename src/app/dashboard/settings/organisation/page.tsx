"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Subsidiary = { id: string; name: string; created_at: string };
type OrgFunction = {
  id: string;
  name: string;
  subsidiary_id: string | null;
  is_project_type: boolean;
  created_at: string;
};
type Team = {
  id: string;
  name: string;
  function_id: string;
  is_adhoc: boolean;
  created_at: string;
};

// ---------------------------------------------------------------------------
// /dashboard/settings/organisation — Org Hierarchy Management
// ---------------------------------------------------------------------------

export default function OrganisationSettingsPage() {
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";

  // ----- State -----
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [functions, setFunctions] = useState<OrgFunction[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline form state
  const [addingSub, setAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [addingFn, setAddingFn] = useState(false);
  const [newFnName, setNewFnName] = useState("");
  const [newFnSubId, setNewFnSubId] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamFnId, setNewTeamFnId] = useState("");
  const [newTeamAdhoc, setNewTeamAdhoc] = useState(false);

  // ----- Fetchers -----
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subsRes, fnsRes, teamsRes] = await Promise.all([
        fetch("/api/org/subsidiaries"),
        fetch("/api/org/functions"),
        fetch("/api/org/teams"),
      ]);
      if (!subsRes.ok || !fnsRes.ok || !teamsRes.ok) throw new Error("Failed to load data");
      const [subsData, fnsData, teamsData] = await Promise.all([
        subsRes.json(),
        fnsRes.json(),
        teamsRes.json(),
      ]);
      setSubsidiaries(subsData.subsidiaries ?? []);
      setFunctions(fnsData.functions ?? []);
      setTeams(teamsData.teams ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ----- Helpers -----
  const subNameById = (id: string | null) =>
    id ? subsidiaries.find((s) => s.id === id)?.name ?? "—" : "Org-wide";
  const fnNameById = (id: string) =>
    functions.find((f) => f.id === id)?.name ?? "—";

  // ----- CRUD handlers -----
  async function addSubsidiary() {
    if (!newSubName.trim()) return;
    const res = await fetch("/api/org/subsidiaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubName.trim() }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to add subsidiary");
      return;
    }
    setNewSubName("");
    setAddingSub(false);
    fetchAll();
  }

  async function deleteSubsidiary(id: string) {
    const res = await fetch(`/api/org/subsidiaries?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to delete subsidiary");
      return;
    }
    fetchAll();
  }

  async function addFunction() {
    if (!newFnName.trim()) return;
    const res = await fetch("/api/org/functions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newFnName.trim(),
        subsidiary_id: newFnSubId || null,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to add function");
      return;
    }
    setNewFnName("");
    setNewFnSubId("");
    setAddingFn(false);
    fetchAll();
  }

  async function deleteFunction(id: string) {
    const res = await fetch(`/api/org/functions?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to delete function");
      return;
    }
    fetchAll();
  }

  async function addTeam() {
    if (!newTeamName.trim() || !newTeamFnId) return;
    const res = await fetch("/api/org/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTeamName.trim(),
        function_id: newTeamFnId,
        is_adhoc: newTeamAdhoc,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to add team");
      return;
    }
    setNewTeamName("");
    setNewTeamFnId("");
    setNewTeamAdhoc(false);
    setAddingTeam(false);
    fetchAll();
  }

  async function deleteTeam(id: string) {
    const res = await fetch(`/api/org/teams?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to delete team");
      return;
    }
    fetchAll();
  }

  // ----- Render -----
  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Loading organisation structure...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ---- Subsidiaries ---- */}
      <section className="border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Subsidiaries</h2>
          {isOwner && (
            <button
              onClick={() => setAddingSub(true)}
              className="px-3 py-1.5 rounded bg-brand text-white text-sm font-medium hover:bg-brand-hover"
            >
              Add
            </button>
          )}
        </div>

        {subsidiaries.length === 0 && !addingSub && (
          <p className="text-sm text-muted-foreground">
            No subsidiaries defined. Add one if your organisation has multiple legal entities.
          </p>
        )}

        {subsidiaries.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subsidiaries.map((s) => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="py-2">{s.name}</td>
                  <td className="py-2">
                    {isOwner && (
                      <button
                        onClick={() => deleteSubsidiary(s.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {addingSub && (
          <div className="flex gap-2 items-end">
            <input
              type="text"
              placeholder="Subsidiary name"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubsidiary()}
              className="flex-1 px-3 py-2 border border-border rounded text-sm bg-background"
              autoFocus
            />
            <button
              onClick={addSubsidiary}
              className="px-3 py-2 rounded bg-brand text-white text-sm font-medium hover:bg-brand-hover"
            >
              Save
            </button>
            <button
              onClick={() => { setAddingSub(false); setNewSubName(""); }}
              className="px-3 py-2 rounded border border-border text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* ---- Functions ---- */}
      <section className="border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Functions</h2>
          {isOwner && (
            <button
              onClick={() => setAddingFn(true)}
              className="px-3 py-1.5 rounded bg-brand text-white text-sm font-medium hover:bg-brand-hover"
            >
              Add
            </button>
          )}
        </div>

        {functions.length === 0 && !addingFn && (
          <p className="text-sm text-muted-foreground">No functions defined yet.</p>
        )}

        {functions.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Subsidiary</th>
                <th className="py-2 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {functions.map((fn) => (
                <tr key={fn.id} className="border-b border-border/50">
                  <td className="py-2">
                    {fn.name}
                    {fn.is_project_type && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {subNameById(fn.subsidiary_id)}
                  </td>
                  <td className="py-2">
                    {isOwner && !fn.is_project_type && (
                      <button
                        onClick={() => deleteFunction(fn.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {addingFn && (
          <div className="flex gap-2 items-end flex-wrap">
            <input
              type="text"
              placeholder="Function name"
              value={newFnName}
              onChange={(e) => setNewFnName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFunction()}
              className="flex-1 min-w-[200px] px-3 py-2 border border-border rounded text-sm bg-background"
              autoFocus
            />
            <select
              value={newFnSubId}
              onChange={(e) => setNewFnSubId(e.target.value)}
              className="px-3 py-2 border border-border rounded text-sm bg-background"
            >
              <option value="">Org-wide (no subsidiary)</option>
              {subsidiaries.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={addFunction}
              className="px-3 py-2 rounded bg-brand text-white text-sm font-medium hover:bg-brand-hover"
            >
              Save
            </button>
            <button
              onClick={() => { setAddingFn(false); setNewFnName(""); setNewFnSubId(""); }}
              className="px-3 py-2 rounded border border-border text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* ---- Teams ---- */}
      <section className="border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Teams</h2>
          {isOwner && (
            <button
              onClick={() => setAddingTeam(true)}
              className="px-3 py-1.5 rounded bg-brand text-white text-sm font-medium hover:bg-brand-hover"
            >
              Add
            </button>
          )}
        </div>

        {teams.length === 0 && !addingTeam && (
          <p className="text-sm text-muted-foreground">No teams defined yet.</p>
        )}

        {teams.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Function</th>
                <th className="py-2 font-medium w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2">
                    {t.name}
                    {t.is_adhoc && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 font-medium">
                        Ad-hoc
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">{fnNameById(t.function_id)}</td>
                  <td className="py-2">
                    {isOwner && (
                      <button
                        onClick={() => deleteTeam(t.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {addingTeam && (
          <div className="flex gap-2 items-end flex-wrap">
            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTeam()}
              className="flex-1 min-w-[200px] px-3 py-2 border border-border rounded text-sm bg-background"
              autoFocus
            />
            <select
              value={newTeamFnId}
              onChange={(e) => setNewTeamFnId(e.target.value)}
              className="px-3 py-2 border border-border rounded text-sm bg-background"
            >
              <option value="">Select function...</option>
              {functions.map((fn) => (
                <option key={fn.id} value={fn.id}>{fn.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={newTeamAdhoc}
                onChange={(e) => setNewTeamAdhoc(e.target.checked)}
                className="rounded border-border"
              />
              Ad-hoc
            </label>
            <button
              onClick={addTeam}
              className="px-3 py-2 rounded bg-brand text-white text-sm font-medium hover:bg-brand-hover"
            >
              Save
            </button>
            <button
              onClick={() => { setAddingTeam(false); setNewTeamName(""); setNewTeamFnId(""); setNewTeamAdhoc(false); }}
              className="px-3 py-2 rounded border border-border text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
