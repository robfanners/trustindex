"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-auth-browser";
import { getClientOrigin } from "@/lib/url";

// ---------------------------------------------------------------------------
// OnboardingForm — multi-step: profile info → email (magic link)
// ---------------------------------------------------------------------------

type OnboardingFormProps = {
  /** Called when the magic link email has been sent successfully */
  onComplete?: () => void;
};

const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1001-5000",
  "5000+",
];

const ROLES = [
  "Individual Contributor",
  "Team Lead",
  "Manager",
  "Director",
  "VP / C-Suite",
  "Founder",
  "Consultant / Advisor",
  "Other",
];

export default function OnboardingForm({ onComplete }: OnboardingFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=profile, 2=email, 3=sent
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();
  const siteUrl = getClientOrigin();

  // Step 1 → Step 2
  function handleProfileNext(e: React.FormEvent) {
    e.preventDefault();
    setStep(2);
  }

  // Step 2 → send magic link
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Store onboarding data in localStorage for the callback to pick up
    try {
      localStorage.setItem(
        "ti_onboarding_pending",
        JSON.stringify({ fullName, companyName, companySize, role })
      );
    } catch {
      // localStorage unavailable — continue anyway
    }

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard&claim=1`,
      },
    });

    setLoading(false);

    if (authError) {
      const msg = authError.message.toLowerCase();
      if (msg.includes("email") || msg.includes("rate") || msg.includes("limit")) {
        setError(
          "Unable to send email. Please check your email address and try again, or try a different email."
        );
      } else {
        setError(authError.message);
      }
    } else {
      setStep(3);
      onComplete?.();
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Confirmation
  // -------------------------------------------------------------------------

  if (step === 3) {
    return (
      <div className="border border-border rounded-lg p-6 space-y-3">
        <div className="bg-brand/10 border border-brand/30 rounded-lg p-6 text-center">
          <p className="text-foreground font-medium mb-1">
            Check your email
          </p>
          <p className="text-sm text-muted-foreground">
            We sent a sign-in link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Click the link to save your results and access your dashboard.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Step 2: Email
  // -------------------------------------------------------------------------

  if (step === 2) {
    return (
      <div className="border border-border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">Almost there — enter your email</h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ll send you a magic link. No password needed.
        </p>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                placeholder:text-muted-foreground/60"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-brand text-white font-semibold rounded-full
                shadow-lg shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5
                transition-all duration-300 disabled:opacity-50 text-sm"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Step 1: Profile info
  // -------------------------------------------------------------------------

  return (
    <div className="border border-border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold">Create your free account</h3>
      <p className="text-sm text-muted-foreground">
        Tell us a bit about yourself to personalise your experience.
      </p>
      <form onSubmit={handleProfileNext} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            Full name
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
              placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            Company name
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Inc"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
              placeholder:text-muted-foreground/60"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            Company size
          </label>
          <select
            required
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          >
            <option value="">Select…</option>
            {COMPANY_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} employees
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            Your role
          </label>
          <select
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          >
            <option value="">Select…</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="px-5 py-2 bg-brand text-white font-medium rounded-lg
            hover:bg-brand/90 transition-colors text-sm"
        >
          Continue →
        </button>
      </form>
    </div>
  );
}
