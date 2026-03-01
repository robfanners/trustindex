"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";

type ToolEntry = {
  name: string;
  purpose: string;
  frequency: string;
  dataTypes: string[];
};

const DATA_TYPE_OPTIONS = [
  "Personal data",
  "Client/customer data",
  "Financial data",
  "Health data",
  "Internal documents",
  "Public data only",
  "Code / technical data",
  "Other",
];

const FREQUENCY_OPTIONS = ["Daily", "Weekly", "Monthly", "Rarely"];

export default function DeclarePage() {
  const { token } = useParams<{ token: string }>();

  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "submitted">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [orgName, setOrgName] = useState("");
  const [tokenLabel, setTokenLabel] = useState("");

  // Form state
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [tools, setTools] = useState<ToolEntry[]>([
    { name: "", purpose: "", frequency: "Weekly", dataTypes: [] },
  ]);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) return;
    fetch(`/api/declarations/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setOrgName(data.organisationName);
          setTokenLabel(data.label || "");
          setStatus("valid");
        } else {
          setErrorMsg(data.error || "Invalid link");
          setStatus("invalid");
        }
      })
      .catch(() => {
        setErrorMsg("Could not validate this link. Please try again.");
        setStatus("invalid");
      });
  }, [token]);

  function addTool() {
    setTools([...tools, { name: "", purpose: "", frequency: "Weekly", dataTypes: [] }]);
  }

  function removeTool(index: number) {
    setTools(tools.filter((_, i) => i !== index));
  }

  function updateTool(index: number, field: keyof ToolEntry, value: string | string[]) {
    setTools(tools.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function toggleDataType(toolIndex: number, dataType: string) {
    const tool = tools[toolIndex];
    const current = tool.dataTypes;
    const updated = current.includes(dataType)
      ? current.filter((d) => d !== dataType)
      : [...current, dataType];
    updateTool(toolIndex, "dataTypes", updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staffName.trim()) return;

    const validTools = tools.filter((t) => t.name.trim());
    if (validTools.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/declarations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffName: staffName.trim(),
          staffEmail: staffEmail.trim() || null,
          department: department.trim() || null,
          toolsDeclared: validTools,
          additionalNotes: additionalNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("submitted");
      } else {
        alert(data.error || "Failed to submit. Please try again.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Loading ---
  if (status === "loading") {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-12 text-center text-muted-foreground">
          Validating your declaration link...
        </div>
      </AppShell>
    );
  }

  // --- Invalid ---
  if (status === "invalid") {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-12 text-center space-y-4">
          <div className="text-4xl">&#128683;</div>
          <h1 className="text-2xl font-bold">Link not valid</h1>
          <p className="text-muted-foreground">{errorMsg}</p>
          <p className="text-sm text-muted-foreground">
            Please contact your organisation administrator for a new link.
          </p>
        </div>
      </AppShell>
    );
  }

  // --- Submitted ---
  if (status === "submitted") {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-12 text-center space-y-4">
          <div className="text-4xl">&#10004;&#65039;</div>
          <h1 className="text-2xl font-bold">Declaration submitted</h1>
          <p className="text-muted-foreground">
            Thank you, {staffName}. Your AI usage declaration for{" "}
            <strong>{orgName}</strong> has been recorded.
          </p>
          <p className="text-sm text-muted-foreground">
            You can close this page. If you need to update your declaration,
            use the same link to submit again.
          </p>
        </div>
      </AppShell>
    );
  }

  // --- Form ---
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">AI Usage Declaration</h1>
          <p className="text-muted-foreground">
            <strong>{orgName}</strong> is building a register of AI tools used
            across the organisation. Please declare the AI tools you use in your
            work.
          </p>
          {tokenLabel && (
            <p className="text-sm text-muted-foreground">
              Declaration: {tokenLabel}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            This helps your organisation stay compliant with AI governance
            requirements. Your responses are confidential to your organisation&apos;s
            governance team.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* About you */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">About you</legend>
            <div>
              <label className="block text-sm font-medium mb-1">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                required
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                placeholder="Jane Smith"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Email (optional)
                </label>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  placeholder="jane@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Department (optional)
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                  placeholder="Marketing"
                />
              </div>
            </div>
          </fieldset>

          {/* AI tools */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">
              AI tools you use <span className="text-red-500">*</span>
            </legend>
            <p className="text-sm text-muted-foreground">
              List each AI tool you use for work. Include things like ChatGPT,
              Claude, Copilot, Midjourney, Jasper, etc.
            </p>

            {tools.map((tool, i) => (
              <div
                key={i}
                className="border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tool {i + 1}</span>
                  {tools.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTool(i)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Tool name
                    </label>
                    <input
                      type="text"
                      value={tool.name}
                      onChange={(e) => updateTool(i, "name", e.target.value)}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                      placeholder="e.g. ChatGPT"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      How often
                    </label>
                    <select
                      value={tool.frequency}
                      onChange={(e) => updateTool(i, "frequency", e.target.value)}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                    >
                      {FREQUENCY_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    What do you use it for?
                  </label>
                  <input
                    type="text"
                    value={tool.purpose}
                    onChange={(e) => updateTool(i, "purpose", e.target.value)}
                    className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
                    placeholder="e.g. Writing marketing copy, summarising reports"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    What types of data do you input?
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {DATA_TYPE_OPTIONS.map((dt) => (
                      <button
                        key={dt}
                        type="button"
                        onClick={() => toggleDataType(i, dt)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          tool.dataTypes.includes(dt)
                            ? "bg-brand text-white border-brand"
                            : "border-border text-muted-foreground hover:border-brand"
                        }`}
                      >
                        {dt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addTool}
              className="text-sm text-brand hover:underline"
            >
              + Add another tool
            </button>
          </fieldset>

          {/* Additional notes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Additional notes (optional)
            </label>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={3}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
              placeholder="Anything else your governance team should know about your AI usage?"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand text-white font-semibold py-3 rounded hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit declaration"}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Powered by{" "}
            <a
              href="https://verisum.org"
              className="text-brand hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Verisum
            </a>{" "}
            &mdash; AI governance for SMEs
          </p>
        </form>
      </div>
    </AppShell>
  );
}
