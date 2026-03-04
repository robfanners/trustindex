import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// ---------------------------------------------------------------------------
// env validation
// ---------------------------------------------------------------------------
// env.ts runs validation at import time (top-level side effects), so we must
// use vi.resetModules() + dynamic import to re-evaluate it per test.
// ---------------------------------------------------------------------------
describe("env validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL"
    );
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
  });

  it("error message includes 'Missing required environment variables'", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(() => import("@/lib/env")).rejects.toThrow(
      "Missing required environment variables"
    );
  });

  it("does not throw when all required vars are present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    const mod = await import("@/lib/env");
    expect(mod.env.SUPABASE_URL).toBe("https://test.supabase.co");
    expect(mod.env.SUPABASE_ANON_KEY).toBe("test-anon-key");
    expect(mod.env.SUPABASE_SERVICE_ROLE_KEY).toBe("test-service-key");
  });

  it("warns for optional vars when NODE_ENV is not 'test'", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.NODE_ENV = "development";

    // Remove all optional vars to trigger warnings
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.CRON_SECRET;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await import("@/lib/env");

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain(
      "Optional environment variables not set"
    );

    warnSpy.mockRestore();
  });
});
