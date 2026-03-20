import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { Mock } from "vitest";
import {
  mockPostRequest,
  mockGetRequest,
  mockAuthorized,
  createMockSupabase,
} from "@/lib/__tests__/test-helpers";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route
// ---------------------------------------------------------------------------
vi.mock("@/lib/requireTier", () => ({
  requireTier: vi.fn(),
}));
vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: vi.fn(),
}));

import { GET, POST } from "@/app/api/monitor/signals/route";
import { requireTier } from "@/lib/requireTier";
import { supabaseServer } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockUnauthorized = {
  authorized: false as const,
  response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
};

const mockNoOrg = {
  authorized: true as const,
  userId: "user-123",
  plan: "pro",
  orgId: null,
};

// The signals route uses plain Request, not NextRequest, for its handler signatures.
// Our mockPostRequest creates NextRequest, which extends Request, so it works.

// ---------------------------------------------------------------------------
// POST /api/monitor/signals
// ---------------------------------------------------------------------------
describe("POST /api/monitor/signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockUnauthorized);

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 400 when no organisation linked", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockNoOrg);

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No organisation");
  });

  it("returns 400 when system_name is missing", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when system_name is empty", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      system_name: "",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when metric_value is not a number", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: "not-a-number",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("returns 400 when signal_type is invalid", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "invalid_type",
      metric_name: "f1_score",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when metric_name is missing", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 201 on valid signal", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const signalRow = {
      id: "sig-1",
      organisation_id: "org-456",
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.92,
      severity: "info",
      source: "manual",
      context: {},
    };

    const mockDb = createMockSupabase(signalRow);
    (supabaseServer as unknown as Mock).mockReturnValue(mockDb);

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.signal).toBeDefined();
    expect(json.signal.system_name).toBe("chat-model");
    expect(json.signal.metric_value).toBe(0.92);
  });

  it("returns 201 with optional severity and source", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const signalRow = {
      id: "sig-2",
      system_name: "fraud-detector",
      signal_type: "fairness",
      metric_name: "disparate_impact",
      metric_value: 1.15,
      severity: "warning",
      source: "webhook",
      context: { region: "EU" },
    };

    const mockDb = createMockSupabase(signalRow);
    (supabaseServer as unknown as Mock).mockReturnValue(mockDb);

    const req = mockPostRequest({
      system_name: "fraud-detector",
      signal_type: "fairness",
      metric_name: "disparate_impact",
      metric_value: 1.15,
      severity: "warning",
      source: "webhook",
      context: { region: "EU" },
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.signal.severity).toBe("warning");
    expect(json.signal.source).toBe("webhook");
  });

  it("returns 500 when Supabase insert fails", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const mockDb = createMockSupabase(null, { message: "Insert failed" });
    (supabaseServer as unknown as Mock).mockReturnValue(mockDb);

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to create signal");
  });
});

// ---------------------------------------------------------------------------
// GET /api/monitor/signals
// ---------------------------------------------------------------------------
describe("GET /api/monitor/signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockUnauthorized);

    const req = mockGetRequest("/api/monitor/signals");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 when no organisation linked", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockNoOrg);

    const req = mockGetRequest("/api/monitor/signals");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No organisation");
  });

  it("returns 200 with signals array", async () => {
    (requireTier as unknown as Mock).mockResolvedValue(mockAuthorized);

    const rows = [
      { id: "sig-1", metric_value: 0.92 },
      { id: "sig-2", metric_value: 1.15 },
    ];

    // The GET handler makes two queries: one for data and one for count.
    // Both use the chainable pattern ending with implicit await (no .single())
    const mockDb: Record<string, unknown> & {
      from: Mock;
      select: Mock;
      eq: Mock;
      gte: Mock;
      order: Mock;
      range: Mock;
    } = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      gte: vi.fn(() => mockDb),
      order: vi.fn(() => mockDb),
      range: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    };

    // For the count query, we need a separate resolution
    let fromCallCount = 0;
    mockDb.from.mockImplementation(() => {
      fromCallCount++;
      const countChain: Record<string, unknown> & {
        from: Mock;
        select: Mock;
        eq: Mock;
        gte: Mock;
        order: Mock;
        range: Mock;
        then: undefined;
      } = {
        from: vi.fn(() => countChain),
        select: vi.fn(() => countChain),
        eq: vi.fn(() => countChain),
        gte: vi.fn(() => countChain),
        order: vi.fn(() => countChain),
        range: vi.fn(() =>
          Promise.resolve({ data: rows, error: null })
        ),
        // Count query resolves as a thenable
        then: undefined,
      };
      if (fromCallCount <= 1) {
        // First query (data): return chainable with range
        return mockDb;
      }
      // Second query (count): resolves directly with count
      // The count query doesn't use range, it resolves implicitly
      const countResult = Promise.resolve({ count: 2 });
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this; }),
          gte: vi.fn(function () { return this; }),
          then: (resolve: (value: unknown) => void) => countResult.then(resolve),
        })),
      };
    });

    (supabaseServer as unknown as Mock).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/monitor/signals?page=1&per_page=20");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signals).toBeDefined();
  });
});
