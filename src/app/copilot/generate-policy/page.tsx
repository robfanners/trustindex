"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canGeneratePolicy, canEditPolicy } from "@/lib/entitlements";
import AuthenticatedShell from "@/components/AuthenticatedShell";
import RequireAuth from "@/components/RequireAuth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLICY_TYPES = [
  {
    value: "acceptable_use",
    label: "AI Acceptable Use Policy",
    description:
      "Defines approved AI tools, use cases, prohibited activities, and staff responsibilities.",
  },
  {
    value: "data_handling",
    label: "Data Handling Addendum",
    description:
      "Covers data classification, personal data restrictions, retention, and breach procedures for AI tools.",
  },
  {
    value: "staff_guidelines",
    label: "Staff Guidelines",
    description:
      "Practical, non-technical guide for employees on responsible AI usage and escalation.",
  },
] as const;

const INDUSTRIES = [
  "Technology",
  "Financial Services",
  "Healthcare",
  "Legal",
  "Education",
  "Retail / E-commerce",
  "Manufacturing",
  "Professional Services",
  "Media / Publishing",
  "Other",
];

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

const JURISDICTIONS = [
  { value: "uk", label: "United Kingdom" },
  { value: "eu", label: "European Union" },
  { value: "uk_eu", label: "UK + EU" },
  { value: "other", label: "Other / Global" },
];

const SENSITIVITY_LEVELS = [
  { value: "public", label: "Public data only" },
  { value: "internal", label: "Internal / business data" },
  { value: "personal", label: "Personal data (names, emails, etc.)" },
  { value: "sensitive", label: "Sensitive data (financial, health, etc.)" },
];

const COMMON_TOOLS = [
  "ChatGPT",
  "GitHub Copilot",
  "Claude",
  "Gemini",
  "Midjourney",
  "DALL-E",
  "Microsoft Copilot",
  "Jasper",
  "Grammarly AI",
  "Notion AI",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GeneratePolicyPage() {
  return (
    <RequireAuth>
      <GeneratePolicyContent />
    </RequireAuth>
  );
}

function GeneratePolicyContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const plan = profile?.plan ?? "explorer";

  // Redirect if not entitled
  useEffect(() => {
    if (profile && !canGeneratePolicy(plan)) {
      router.push("/upgrade");
    }
  }, [profile, plan, router]);

  // Form state
  const [policyType, setPolicyType] = useState<string>("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [dataSensitivity, setDataSensitivity] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [aiTools, setAiTools] = useState<string[]>([]);
  const [customTool, setCustomTool] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  // Pre-fill company name from profile
  useEffect(() => {
    if (profile?.company_name && !companyName) {
      setCompanyName(profile.company_name);
    }
  }, [profile, companyName]);

  function toggleTool(tool: string) {
    setAiTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  }

  function addCustomTool() {
    const name = customTool.trim();
    if (name && !aiTools.includes(name)) {
      setAiTools((prev) => [...prev, name]);
      setCustomTool("");
    }
  }

  const canSubmit =
    policyType && companyName && industry && companySize && jurisdiction;

  async function handleGenerate() {
    if (!canSubmit) return;
    setGenerating(true);
    setError(null);
    setGeneratedContent(null);
    setRateLimitMsg(null);
    setServiceUnavailable(false);

    try {
      const res = await fetch("/api/copilot/generate-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyType,
          questionnaire: {
            companyName,
            industry,
            companySize,
            aiToolsUsed: aiTools,
            dataSensitivity: dataSensitivity || "internal",
            jurisdiction,
            additionalContext: additionalContext || undefined,
          },
        }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          const data = await res.json().catch(() => null);
          setRateLimitMsg(
            data?.error || "You have reached your policy generation limit for this month."
          );
          return;
        }
        if (res.status === 503) {
          setServiceUnavailable(true);
          return;
        }
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to generate policy");
      }

      const data = await res.json();
      setGeneratedContent(data.policy?.content ?? null);
      if (data.remaining !== undefined) setRemaining(data.remaining);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  if (!canGeneratePolicy(plan)) {
    return null; // Redirect handled above
  }

  // Show generated policy
  if (generatedContent) {
    return (
      <AuthenticatedShell>
        <div className="max-w-3xl mx-auto p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Generated Policy</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {POLICY_TYPES.find((t) => t.value === policyType)?.label}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setGeneratedContent(null);
                  setPolicyType("");
                }}
                className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Generate another
              </button>
              <button
                onClick={() => router.push("/dashboard#copilot")}
                className="text-sm px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
              >
                Back to Copilot
              </button>
            </div>
          </div>

          {!canEditPolicy(plan) && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              Upgrade to Verisum Assure to edit generated policies.
            </div>
          )}

          <div className="border border-border rounded-xl p-6 md:p-8 bg-white prose prose-sm max-w-none">
            {/* Render markdown as simple formatted text */}
            {generatedContent.split("\n").map((line, i) => {
              if (line.startsWith("# ")) {
                return (
                  <h1 key={i} className="text-xl font-bold mt-6 mb-2 first:mt-0">
                    {line.slice(2)}
                  </h1>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-lg font-semibold mt-5 mb-2">
                    {line.slice(3)}
                  </h2>
                );
              }
              if (line.startsWith("### ")) {
                return (
                  <h3 key={i} className="text-base font-semibold mt-4 mb-1">
                    {line.slice(4)}
                  </h3>
                );
              }
              if (line.startsWith("- ") || line.startsWith("* ")) {
                return (
                  <li key={i} className="ml-4 text-sm text-foreground">
                    {line.slice(2)}
                  </li>
                );
              }
              if (/^\d+\.\s/.test(line)) {
                return (
                  <li key={i} className="ml-4 text-sm text-foreground list-decimal">
                    {line.replace(/^\d+\.\s/, "")}
                  </li>
                );
              }
              if (line.trim() === "") {
                return <div key={i} className="h-2" />;
              }
              return (
                <p key={i} className="text-sm text-foreground leading-relaxed">
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </AuthenticatedShell>
    );
  }

  // Show form
  return (
    <AuthenticatedShell>
      <div className="max-w-2xl mx-auto p-6 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Generate AI Policy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Answer a few questions and we&apos;ll generate a tailored governance
            policy for your organisation.
          </p>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800 mb-6">
          <span className="shrink-0 mt-0.5">&#9432;</span>
          <p>
            Policies are generated using AI and tailored to your organisation&apos;s context.
            Always review generated content before adopting.
          </p>
        </div>

        <div className="space-y-6">
          {/* Policy type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Policy type
            </label>
            <div className="space-y-2">
              {POLICY_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setPolicyType(type.value)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    policyType === type.value
                      ? "border-brand bg-brand/5"
                      : "border-border hover:border-brand/50"
                  }`}
                >
                  <span className="text-sm font-medium">{type.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Company details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Company name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Acme Ltd"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Industry <span className="text-red-500">*</span>
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Company size <span className="text-red-500">*</span>
                </label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {COMPANY_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} employees
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Jurisdiction <span className="text-red-500">*</span>
                </label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {JURISDICTIONS.map((j) => (
                    <option key={j.value} value={j.value}>
                      {j.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Data sensitivity
                </label>
                <select
                  value={dataSensitivity}
                  onChange={(e) => setDataSensitivity(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select...</option>
                  {SENSITIVITY_LEVELS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* AI tools */}
          <div>
            <label className="block text-sm font-medium mb-2">
              AI tools used
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_TOOLS.map((tool) => {
                const selected = aiTools.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selected
                        ? "bg-brand/10 border-brand text-brand"
                        : "border-border hover:border-brand hover:text-brand"
                    }`}
                  >
                    {selected ? `\u2713 ${tool}` : `+ ${tool}`}
                  </button>
                );
              })}
            </div>
            {/* Custom tool entry */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customTool}
                onChange={(e) => setCustomTool(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomTool()}
                placeholder="Add custom tool..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
              <button
                onClick={addCustomTool}
                disabled={!customTool.trim()}
                className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
            {/* Show non-common selected tools */}
            {aiTools.filter((t) => !COMMON_TOOLS.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {aiTools
                  .filter((t) => !COMMON_TOOLS.includes(t))
                  .map((tool) => (
                    <span
                      key={tool}
                      className="text-xs px-3 py-1.5 rounded-full bg-brand/10 border border-brand text-brand flex items-center gap-1"
                    >
                      {tool}
                      <button
                        onClick={() => toggleTool(tool)}
                        className="hover:text-red-500"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Additional context */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Additional context{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
              placeholder="Any specific requirements, regulatory concerns, or context..."
            />
          </div>

          {/* Rate limit */}
          {rateLimitMsg && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <p>{rateLimitMsg}</p>
              <button
                onClick={() => router.push("/upgrade")}
                className="mt-2 text-xs font-medium underline hover:no-underline"
              >
                Upgrade your plan for more generations
              </button>
            </div>
          )}

          {/* Service unavailable */}
          {serviceUnavailable && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              Policy generation is temporarily unavailable. Please try again in a few minutes.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={() => router.push("/dashboard#copilot")}
              className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canSubmit || generating}
              className="text-sm px-5 py-2.5 rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50 font-medium transition-colors"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Policy"
              )}
            </button>
          </div>
          {remaining !== null && (
            <p className="text-xs text-muted-foreground text-center">
              {remaining} generation{remaining !== 1 ? "s" : ""} remaining this month
            </p>
          )}
        </div>
      </div>
    </AuthenticatedShell>
  );
}
