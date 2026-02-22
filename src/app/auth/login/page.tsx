"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-auth-browser";
import { useAuth } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseBrowserClient();

  // Read `next` param once — used for both auto-redirect and magic link callback
  const next =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next") ?? "/dashboard"
      : "/dashboard";

  // If the user is already authenticated, redirect them away from login
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = next;
    }
  }, [authLoading, user, next]);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

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
          <h1 className="text-2xl font-semibold text-verisum-black text-center mb-2">
            Sign in or create an account
          </h1>
          <p className="text-sm text-verisum-grey text-center mb-8">
            Enter your email and we&apos;ll send you a magic link. No password
            needed — works for new and existing accounts.
          </p>

          {sent ? (
            <div className="bg-verisum-blue/10 border border-verisum-blue/30 rounded-lg p-6 text-center">
              <p className="text-verisum-black font-medium mb-1">
                Check your email
              </p>
              <p className="text-sm text-verisum-grey">
                We sent a sign-in link to{" "}
                <span className="font-medium text-verisum-black">{email}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-verisum-black mb-1"
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
                  className="w-full px-3 py-2 border border-verisum-grey rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-verisum-blue focus:border-transparent
                    placeholder:text-verisum-grey/60"
                />
              </div>

              {error && (
                <p className="text-sm text-verisum-red">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-verisum-blue text-white font-medium rounded-lg
                  hover:bg-verisum-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? "Sending..." : "Send magic link"}
              </button>
            </form>
          )}

          <p className="text-xs text-verisum-grey text-center mt-6">
            New to TrustGraph?{" "}
            <a
              href="/try"
              className="text-verisum-blue hover:text-verisum-blue/80 font-medium"
            >
              Try Explorer for free
            </a>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
