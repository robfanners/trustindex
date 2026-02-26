"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-auth-browser";
import { useAuth } from "@/context/AuthContext";
import { getClientOrigin, safeRedirectPath } from "@/lib/url";
import AppShell from "@/components/AppShell";

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseBrowserClient();

  // Read `next` param once — used for both auto-redirect and magic link callback
  const rawNext =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next")
      : null;
  const next = safeRedirectPath(rawNext);

  // If the user is already authenticated, redirect them away from login
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = next;
    }
  }, [authLoading, user, next]);

  const siteUrl = getClientOrigin();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setLoading(false);

    if (authError) {
      // Map opaque Supabase errors to user-friendly messages
      const msg = authError.message.toLowerCase();
      if (msg.includes("email") || msg.includes("rate") || msg.includes("limit")) {
        setError(
          "Unable to send email. Please check your email address and try again, or try a different email."
        );
      } else {
        setError(authError.message);
      }
    } else {
      setSent(true);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <div className="w-full max-w-sm mx-auto px-4">
          <h1 className="text-2xl font-semibold text-foreground text-center mb-2">
            Sign in or create an account
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Enter your email and we&apos;ll send you a magic link. No password
            needed — works for new and existing accounts.
          </p>

          {sent ? (
            <div className="bg-brand/10 border border-brand/30 rounded-lg p-6 text-center">
              <p className="text-foreground font-medium mb-1">
                Check your email
              </p>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to{" "}
                <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Email address
                </label>
                <input
                  id="email"
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

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-5 bg-brand text-white font-semibold rounded-full
                  shadow-lg shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 hover:shadow-brand/30
                  transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? "Sending..." : "Send magic link"}
              </button>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-6">
            New to TrustGraph?{" "}
            <a
              href="/try"
              className="text-brand hover:text-brand/80 font-medium"
            >
              Try Explorer for free
            </a>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
