import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import {
  mockPostRequest,
  mockGetRequest,
} from "@/lib/__tests__/test-helpers";
import {
  mockApiHelpers,
  mockAudit,
  mockRequireAuthAuthorized,
  mockRequireAuthUnauthorized,
  mockRequireAuthNoOrg,
  createMockSupabase,
} from "@/lib/__tests__/mockAuth";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route (vi.mock is hoisted).
// ---------------------------------------------------------------------------
mockApiHelpers();
mockAudit();

import { GET, POST } from "@/app/api/monitor/signals/route";
import { requireAuth } from "@/lib/apiHelpers";

// ---------------------------------------------------------------------------
// POST /api/monitor/signals
// ---------------------------------------------------------------------------
describe("POST /api/monitor/signals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);

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
    mockRequireAuthNoOrg(requireAuth as unknown as Mock);

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_name: "f1_score",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No organisation linked");
  });

  it("returns 400 when system_name is missing", async () => {
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

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
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

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
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

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
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

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
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, {
      db: createMockSupabase(),
    });

    const req = mockPostRequest({
      system_name: "chat-model",
      signal_type: "accuracy",
      metric_value: 0.92,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 201 on valid signal", async () => {
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

    const mockDb = createMockSupabase({ data: signalRow });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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

    const mockDb = createMockSupabase({ data: signalRow });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
    const mockDb = createMockSupabase({
      data: null,
      error: { message: "Insert failed" },
    });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

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
    mockRequireAuthUnauthorized(requireAuth as unknown as Mock);

    const req = mockGetRequest("/api/monitor/signals");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 when no organisation linked", async () => {
    mockRequireAuthNoOrg(requireAuth as unknown as Mock);

    const req = mockGetRequest("/api/monitor/signals");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No organisation linked");
  });

  it("returns 200 with signals array", async () => {
    const rows = [
      { id: "sig-1", metric_value: 0.92 },
      { id: "sig-2", metric_value: 1.15 },
    ];

    const mockDb = createMockSupabase({ data: rows, count: 2 });
    mockRequireAuthAuthorized(requireAuth as unknown as Mock, { db: mockDb });

    const req = mockGetRequest("/api/monitor/signals?page=1&per_page=20");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signals).toBeDefined();
    expect(Array.isArray(json.signals)).toBe(true);
  });
});
