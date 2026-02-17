"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-auth-browser";

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Signing you in…
      </div>
    </div>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const supabase = createSupabaseBrowserClient();
    const next = searchParams.get("next") ?? "/dashboard";

    // Listen for session establishment
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        subscription.unsubscribe();
        router.replace(next);
      }
    });

    // Try explicit code exchange if ?code= is present (PKCE flow)
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          subscription.unsubscribe();
          router.replace("/auth/login?error=auth_failed");
        }
        // Success handled by onAuthStateChange
      });
    } else {
      // Hash fragment flow — give the client a moment to pick up tokens
      const timeout = setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          subscription.unsubscribe();
          router.replace(next);
        } else {
          subscription.unsubscribe();
          router.replace("/auth/login?error=auth_failed");
        }
      }, 3000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  return <Spinner />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackHandler />
    </Suspense>
  );
}
