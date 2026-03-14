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
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");

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

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "magiclink",
    });

    setLoading(false);

    if (otpError) {
      setError("Invalid or expired code. Please request a new magic link and try again.");
    } else {
      window.location.href = next;
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError("Invalid email or password.");
    } else {
      window.location.href = next;
    }
  }

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
            <div className="space-y-4">
              <div className="bg-brand/10 border border-brand/30 rounded-lg p-6 text-center">
                <p className="text-foreground font-medium mb-1">
                  Check your email
                </p>
                <p className="text-sm text-muted-foreground">
                  We sent a sign-in link to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              {!showOtp ? (
                <button
                  type="button"
                  onClick={() => setShowOtp(true)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Didn&apos;t get the email? Use a sign-in code instead
                </button>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div>
                    <label
                      htmlFor="otp"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Sign-in code
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      maxLength={8}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="00000000"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm text-center tracking-[0.3em] font-mono
                        focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                        placeholder:text-muted-foreground/60"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full py-2.5 px-5 bg-brand text-white font-semibold rounded-full
                      shadow-lg shadow-brand/20 hover:bg-brand-hover hover:-translate-y-0.5 hover:shadow-brand/30
                      transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {loading ? "Verifying..." : "Sign in with code"}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => { setSent(false); setShowOtp(false); setOtp(""); setError(null); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Try a different email
              </button>
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

          {!sent && !showPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(true)}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
              Sign in with password instead
            </button>
          )}

          {showPassword && !sent && (
            <form onSubmit={handlePasswordLogin} className="space-y-4 mt-4 pt-4 border-t border-border">
              <div>
                <label
                  htmlFor="pw-email"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Email address
                </label>
                <input
                  id="pw-email"
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
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
                {loading ? "Signing in..." : "Sign in"}
              </button>

              <button
                type="button"
                onClick={() => { setShowPassword(false); setError(null); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Use magic link instead
              </button>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-6">
            New to Verisum?{" "}
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
