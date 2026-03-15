"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canAccessWizard } from "@/lib/entitlements";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import type { WizardResponses } from "@/lib/governancePrompts";

const INDUSTRIES = [
  "Technology", "Financial Services", "Healthcare", "Legal",
  "Education", "Retail / E-commerce", "Manufacturing",
  "Professional Services", "Media / Publishing", "Other",
];

const HEADCOUNT_RANGES = [
  "1-10", "11-50", "51-200", "201-500", "500+",
];

const JURISDICTIONS = [
  { value: "uk", label: "United Kingdom" },
  { value: "eu", label: "European Union" },
  { value: "uk_eu", label: "UK + EU" },
  { value: "other", label: "Other / Global" },
];

const COMMON_TOOLS = [
  "ChatGPT", "GitHub Copilot", "Claude", "Gemini",
  "Midjourney", "DALL-E", "Microsoft Copilot",
  "Jasper", "Grammarly AI", "Notion AI",
];

const PURPOSES = [
  "Content creation", "Code assistance", "Data analysis",
  "Customer-facing", "Internal operations", "Research",
];

const DATA_CLASSIFICATIONS = [
  { value: "public", label: "Public data only" },
  { value: "internal", label: "Internal / business data" },
  { value: "personal", label: "Personal data (names, emails, etc.)" },
  { value: "sensitive", label: "Sensitive data (financial, health, etc.)" },
];

type ToolEntry = {
  name: string;
  purpose: string;
  dataClassification: string;
  departments: string;
};

const STEPS = ["Company Profile", "AI Tool Inventory", "Control Posture", "Review & Generate"];

const CONTROL_QUESTIONS = [
  {
    key: "hasPolicy",
    question: "Do you have an AI usage policy?",
    shortLabel: "AI usage policy",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "partial", label: "Partial / Draft" },
    ],
  },
  {
    key: "requiresApproval",
    question: "Do staff need approval before using AI tools?",
    shortLabel: "Staff approval required",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "for_some", label: "For some tools" },
    ],
  },
  {
    key: "humanReview",
    question: "Are AI outputs reviewed by a human before use?",
    shortLabel: "Human review of outputs",
    options: [
      { value: "always", label: "Always" },
      { value: "sometimes", label: "Sometimes" },
      { value: "never", label: "Never" },
    ],
  },
  {
    key: "logsUsage",
    question: "Do you log which AI tools are used and for what?",
    shortLabel: "Usage logging",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "partially", label: "Partially" },
    ],
  },
  {
    key: "staffTrained",
    question: "Have staff been trained on responsible AI use?",
    shortLabel: "Staff training",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "planned", label: "Planned" },
    ],
  },
  {
    key: "incidentProcess",
    question: "Do you have a process for handling AI-related incidents?",
    shortLabel: "Incident process",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "informal", label: "Informal" },
    ],
  },
  {
    key: "vendorAssessment",
    question: "Do you assess vendors before adopting new AI tools?",
    shortLabel: "Vendor assessment",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "sometimes", label: "Sometimes" },
    ],
  },
  {
    key: "namedResponsible",
    question: "Is there a named person responsible for AI governance?",
    shortLabel: "Named responsible person",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "hasDefinedIntents",
    question:
      "Have you defined authorised goals and boundaries (Intent-Based Governance\u2122) for your AI systems?",
    shortLabel: "Intent-Based Governance\u2122",
    options: [
      { value: "yes", label: "Yes \u2014 goals, action spaces, and blast radius defined" },
      { value: "partial", label: "Partially \u2014 some elements defined" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "definesBlastRadius",
    question:
      "Have you defined blast radius constraints (how far each AI system\u2019s effects can propagate)?",
    shortLabel: "Blast radius constraints",
    options: [
      { value: "yes", label: "Yes" },
      { value: "partial", label: "For some systems" },
      { value: "no", label: "No" },
    ],
  },
];

export default function SetupPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [wizardId, setWizardId] = useState<string | null>(null);

  // Step 1: Company profile
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");

  // Step 2: Tools
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [showToolForm, setShowToolForm] = useState(false);
  const [newTool, setNewTool] = useState<ToolEntry>({
    name: "", purpose: "", dataClassification: "", departments: "",
  });

  // Step 3: Controls
  const [controls, setControls] = useState({
    hasPolicy: "",
    requiresApproval: "",
    humanReview: "",
    logsUsage: "",
    staffTrained: "",
    incidentProcess: "",
    vendorAssessment: "",
    namedResponsible: "",
    hasDefinedIntents: "",
    definesBlastRadius: "",
  });

  // Load existing wizard data on mount
  useEffect(() => {
    if (!user || loading) return;
    async function load() {
      try {
        const res = await fetch("/api/wizard");
        if (res.ok) {
          const data = await res.json();
          if (data.wizard?.responses) {
            const r = data.wizard.responses as WizardResponses;
            setWizardId(data.wizard.id);
            if (r.company) {
              setCompanyName(r.company.name ?? "");
              setIndustry(r.company.industry ?? "");
              setHeadcount(r.company.headcount ?? "");
              setJurisdiction(r.company.jurisdiction ?? "");
            }
            if (r.tools) setTools(r.tools);
            if (r.controls) setControls((prev) => ({ ...prev, ...r.controls }));
            // If wizard was already completed, allow re-run from start
            if (data.wizard.completed_at) {
              setWizardId(null); // Will create a new version
            }
          }
        }
      } catch {
        // silent — first time user
      }
    }
    load();
  }, [user, loading]);

  // Pre-fill company name from profile
  useEffect(() => {
    if (profile?.company_name && !companyName) {
      setCompanyName(profile.company_name);
    }
  }, [profile, companyName]);

  if (loading) {
    return (
      <AuthenticatedShell>
        <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground">Loading...</div>
      </AuthenticatedShell>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }
  if (!profile) {
    // Profile still loading after auth — show spinner, don't redirect
    return (
      <AuthenticatedShell>
        <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground">Loading...</div>
      </AuthenticatedShell>
    );
  }

  if (!canAccessWizard(profile.plan)) {
    router.push("/upgrade");
    return null;
  }

  function buildResponses(): WizardResponses {
    return {
      company: { name: companyName, industry, headcount, jurisdiction },
      tools,
      controls,
    };
  }

  async function saveProgress() {
    setSaving(true);
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: buildResponses() }),
      });
      if (res.ok) {
        const data = await res.json();
        setWizardId(data.wizard.id);
      }
    } catch {
      // silent save failure
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await saveProgress();
    setStep((s) => Math.min(s + 1, 3));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function addTool() {
    if (!newTool.name) return;
    setTools((prev) => [...prev, { ...newTool }]);
    setNewTool({ name: "", purpose: "", dataClassification: "", departments: "" });
    setShowToolForm(false);
  }

  function removeTool(index: number) {
    setTools((prev) => prev.filter((_, i) => i !== index));
  }

  function addCommonTool(name: string) {
    if (tools.some((t) => t.name === name)) return;
    setTools((prev) => [...prev, { name, purpose: "", dataClassification: "", departments: "" }]);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError("");
    setGenerateStatus("Saving your responses...");
    try {
      // Ensure wizard is saved first
      let currentWizardId = wizardId;
      if (!currentWizardId) {
        const saveRes = await fetch("/api/wizard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses: buildResponses() }),
        });
        if (!saveRes.ok) {
          setGenerateError("Failed to save your responses. Please try again.");
          return;
        }
        const saveData = await saveRes.json();
        currentWizardId = saveData.wizard.id;
        setWizardId(currentWizardId);
      }

      // Complete the wizard
      setGenerateStatus("Completing setup...");
      const completeRes = await fetch("/api/wizard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardId: currentWizardId }),
      });
      if (!completeRes.ok) {
        setGenerateError("Failed to complete wizard. Please try again.");
        return;
      }

      // Trigger pack generation (this is the slow step — AI generation)
      setGenerateStatus("Generating your governance pack — this may take a minute or two. Please do not navigate away.");
      const packRes = await fetch("/api/governance-pack/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wizardId: currentWizardId }),
      });
      if (packRes.ok) {
        router.push("/dashboard#copilot");
      } else {
        const err = await packRes.json().catch(() => ({ error: "Pack generation failed." }));
        setGenerateError(err.error || "Pack generation failed. Please try again.");
      }
    } catch {
      setGenerateError("Something went wrong. Please check your connection and try again.");
    } finally {
      setGenerating(false);
      setGenerateStatus("");
    }
  }

  return (
    <AuthenticatedShell>
      <div className="max-w-2xl mx-auto p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-2">AI Governance Setup</h1>
        <p className="text-muted-foreground mb-6">
          Answer a few questions about your AI usage and controls. We&apos;ll generate your governance pack.
        </p>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${
                  i <= step ? "bg-brand" : "bg-muted"
                }`}
              />
              <p className={`text-xs mt-1 ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Step 1: Company Profile */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Acme Ltd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Headcount</label>
              <select
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select range...</option>
                {HEADCOUNT_RANGES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Primary jurisdiction</label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select jurisdiction...</option>
                {JURISDICTIONS.map((j) => (
                  <option key={j.value} value={j.value}>{j.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: AI Tool Inventory */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click common tools to add them, or add custom tools below.
            </p>

            {/* Quick-add common tools */}
            <div className="flex flex-wrap gap-2">
              {COMMON_TOOLS.map((name) => {
                const added = tools.some((t) => t.name === name);
                return (
                  <button
                    key={name}
                    onClick={() => addCommonTool(name)}
                    disabled={added}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      added
                        ? "bg-brand/10 border-brand text-brand"
                        : "border-border hover:border-brand hover:text-brand"
                    }`}
                  >
                    {added ? `✓ ${name}` : `+ ${name}`}
                  </button>
                );
              })}
            </div>

            {/* Added tools list */}
            {tools.length > 0 && (
              <div className="space-y-2">
                {tools.map((tool, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">{tool.name}</span>
                      <button
                        onClick={() => removeTool(i)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={tool.purpose}
                        onChange={(e) => {
                          const updated = [...tools];
                          updated[i] = { ...updated[i], purpose: e.target.value };
                          setTools(updated);
                        }}
                        className="text-xs rounded border border-border bg-background px-2 py-1"
                      >
                        <option value="">Purpose...</option>
                        {PURPOSES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        value={tool.dataClassification}
                        onChange={(e) => {
                          const updated = [...tools];
                          updated[i] = { ...updated[i], dataClassification: e.target.value };
                          setTools(updated);
                        }}
                        className="text-xs rounded border border-border bg-background px-2 py-1"
                      >
                        <option value="">Data type...</option>
                        {DATA_CLASSIFICATIONS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={tool.departments}
                        onChange={(e) => {
                          const updated = [...tools];
                          updated[i] = { ...updated[i], departments: e.target.value };
                          setTools(updated);
                        }}
                        placeholder="Departments..."
                        className="text-xs rounded border border-border bg-background px-2 py-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add custom tool */}
            {showToolForm ? (
              <div className="border border-dashed rounded-lg p-3 space-y-2">
                <input
                  type="text"
                  value={newTool.name}
                  onChange={(e) => setNewTool((t) => ({ ...t, name: e.target.value }))}
                  placeholder="Tool name"
                  className="w-full text-sm rounded border border-border bg-background px-3 py-1.5"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addTool}
                    disabled={!newTool.name}
                    className="text-xs px-3 py-1.5 rounded bg-brand text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowToolForm(false)}
                    className="text-xs px-3 py-1.5 rounded border border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowToolForm(true)}
                className="text-sm text-brand hover:underline"
              >
                + Add custom tool
              </button>
            )}
          </div>
        )}

        {/* Step 3: Control Posture */}
        {step === 2 && (
          <div className="space-y-5">
            {CONTROL_QUESTIONS.map((q) => (
              <div key={q.key}>
                <p className="text-sm font-medium mb-2">{q.question}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setControls((c) => ({ ...c, [q.key]: opt.value }))}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        controls[q.key as keyof typeof controls] === opt.value
                          ? "bg-brand text-white border-brand"
                          : "border-border hover:border-brand"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Review & Generate */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">Company</h3>
              <p className="text-sm text-muted-foreground">
                {companyName} &middot; {industry} &middot; {headcount} employees &middot; {jurisdiction}
              </p>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">AI Tools ({tools.length})</h3>
              {tools.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tools declared</p>
              ) : (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {tools.map((t, i) => (
                    <li key={i}>{t.name}{t.purpose ? ` — ${t.purpose}` : ""}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium">Control Posture</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                {Object.entries(controls).map(([key, val]) => {
                  const q = CONTROL_QUESTIONS.find((cq) => cq.key === key);
                  return (
                    <li key={key}>
                      <span className={val === "yes" || val === "always" ? "text-green-600" : val === "no" || val === "never" ? "text-red-500" : "text-amber-500"}>
                        {val || "—"}
                      </span>
                      {" "}{q?.shortLabel ?? key}
                    </li>
                  );
                })}
              </ul>
            </div>

            {generating && (
              <div className="text-center py-8 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {generateStatus || "Preparing..."}
                </p>
              </div>
            )}

            {generateError && !generating && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {generateError}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-4 border-t">
          {step > 0 ? (
            <button
              onClick={handleBack}
              className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue"}
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="text-sm px-5 py-2.5 rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50 font-medium"
            >
              {generating ? "Generating..." : "Generate Governance Pack"}
            </button>
          )}
        </div>
      </div>
    </AuthenticatedShell>
  );
}
