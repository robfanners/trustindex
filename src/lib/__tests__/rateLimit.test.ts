import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, getClientIp, _resetStore } from "@/lib/rateLimit";

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------
describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request for a new key", () => {
    const result = checkRateLimit("ip-1");
    expect(result).toEqual({ allowed: true });
  });

  it("allows up to maxRequests within the window", () => {
    const opts = { windowMs: 60_000, maxRequests: 5 };
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("ip-2", opts)).toEqual({ allowed: true });
    }
  });

  it("rejects the request exceeding maxRequests", () => {
    const opts = { windowMs: 60_000, maxRequests: 3 };
    checkRateLimit("ip-3", opts);
    checkRateLimit("ip-3", opts);
    checkRateLimit("ip-3", opts);

    const result = checkRateLimit("ip-3", opts);
    expect(result.allowed).toBe(false);
  });

  it("returns a positive retryAfterMs when rejected", () => {
    const opts = { windowMs: 60_000, maxRequests: 1 };
    checkRateLimit("ip-4", opts);

    const result = checkRateLimit("ip-4", opts);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("tracks different keys independently", () => {
    const opts = { windowMs: 60_000, maxRequests: 1 };
    checkRateLimit("ip-a", opts);
    // ip-a is now exhausted
    expect(checkRateLimit("ip-a", opts).allowed).toBe(false);
    // ip-b should still be fresh
    expect(checkRateLimit("ip-b", opts).allowed).toBe(true);
  });

  it("resets and allows requests after the window expires", () => {
    const opts = { windowMs: 10_000, maxRequests: 1 };
    checkRateLimit("ip-5", opts);
    expect(checkRateLimit("ip-5", opts).allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(10_001);

    expect(checkRateLimit("ip-5", opts)).toEqual({ allowed: true });
  });

  it("respects custom windowMs and maxRequests", () => {
    const opts = { windowMs: 500, maxRequests: 2 };
    expect(checkRateLimit("ip-6", opts).allowed).toBe(true);
    expect(checkRateLimit("ip-6", opts).allowed).toBe(true);
    expect(checkRateLimit("ip-6", opts).allowed).toBe(false);

    vi.advanceTimersByTime(501);
    expect(checkRateLimit("ip-6", opts).allowed).toBe(true);
  });

  it("uses default window (60s) and maxRequests (30) when no options given", () => {
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit("ip-default").allowed).toBe(true);
    }
    expect(checkRateLimit("ip-default").allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getClientIp
// ---------------------------------------------------------------------------
describe("getClientIp", () => {
  it("returns the IP from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.50" });
    expect(getClientIp(headers)).toBe("203.0.113.50");
  });

  it("returns the first IP from a comma-separated x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178",
    });
    expect(getClientIp(headers)).toBe("203.0.113.50");
  });

  it("returns x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.1" });
    expect(getClientIp(headers)).toBe("198.51.100.1");
  });

  it('returns "unknown" when no relevant headers are present', () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// _resetStore
// ---------------------------------------------------------------------------
describe("_resetStore", () => {
  beforeEach(() => {
    _resetStore();
  });

  it("clears rate limit state so a previously blocked key is allowed again", () => {
    const opts = { windowMs: 60_000, maxRequests: 1 };
    checkRateLimit("ip-reset", opts);
    expect(checkRateLimit("ip-reset", opts).allowed).toBe(false);

    _resetStore();

    expect(checkRateLimit("ip-reset", opts)).toEqual({ allowed: true });
  });
});
