import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockGetRequest,
  createMockSupabase,
} from "@/lib/__tests__/test-helpers";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the route
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: vi.fn(),
}));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { GET } from "@/app/api/public/verify/route";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkRateLimit } from "@/lib/rateLimit";

// ---------------------------------------------------------------------------
// GET /api/public/verify
// ---------------------------------------------------------------------------
describe("GET /api/public/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit allows requests
    (checkRateLimit as any).mockReturnValue({ allowed: true });
  });

  it("returns 400 when id param is missing", async () => {
    const req = mockGetRequest("/api/public/verify");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id parameter is required");
  });

  it("returns 400 when id param is empty", async () => {
    const req = mockGetRequest("/api/public/verify?id=");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("id parameter is required");
  });

  it("returns 400 when id format is invalid (random string)", async () => {
    const req = mockGetRequest("/api/public/verify?id=INVALID");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid verification ID format");
  });

  it("returns 400 when id format is invalid (missing prefix)", async () => {
    const req = mockGetRequest("/api/public/verify?id=ABCD1234");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid verification ID format");
  });

  it("returns 400 when id format is invalid (too short)", async () => {
    const req = mockGetRequest("/api/public/verify?id=VER-ABC");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when id format is invalid (too long)", async () => {
    const req = mockGetRequest("/api/public/verify?id=VER-ABCDEF123");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as any).mockReturnValue({
      allowed: false,
      retryAfterMs: 30000,
    });

    const req = mockGetRequest("/api/public/verify?id=VER-ABCD1234");
    const res = await GET(req);

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many requests");
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns found:true when attestation found", async () => {
    const attestationData = {
      title: "Ethics Policy",
      statement: "We commit to fair AI",
      attested_at: "2026-01-15T10:00:00Z",
      verification_id: "VER-ABCD1234",
      event_hash: "0xabc123",
      chain_tx_hash: null,
      chain_status: "skipped",
      organisation_id: "org-456",
      created_at: "2026-01-15T10:00:00Z",
    };

    const orgData = { name: "Acme Corp" };

    let singleCallCount = 0;
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      single: vi.fn(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          // First: attestation lookup
          return Promise.resolve({ data: attestationData, error: null });
        }
        if (singleCallCount === 2) {
          // Second: org name lookup
          return Promise.resolve({ data: orgData, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/public/verify?id=VER-ABCD1234");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.found).toBe(true);
    expect(json.type).toBe("attestation");
    expect(json.record.title).toBe("Ethics Policy");
    expect(json.record.organisation_name).toBe("Acme Corp");
    expect(json.record.verification_id).toBe("VER-ABCD1234");
  });

  it("returns found:true when provenance found", async () => {
    const provenanceData = {
      title: "Model Output v2",
      ai_system: "GPT-4",
      model_version: "4.0",
      reviewed_at: "2026-02-01T12:00:00Z",
      verification_id: "VER-BBBB2222",
      event_hash: "0xdef456",
      chain_tx_hash: "0xtx789",
      chain_status: "anchored",
      organisation_id: "org-456",
      created_at: "2026-02-01T12:00:00Z",
    };

    const orgData = { name: "Test Org" };

    let singleCallCount = 0;
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      single: vi.fn(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          // attestation lookup: not found
          return Promise.resolve({ data: null, error: null });
        }
        if (singleCallCount === 2) {
          // provenance lookup: found
          return Promise.resolve({ data: provenanceData, error: null });
        }
        if (singleCallCount === 3) {
          // org name lookup
          return Promise.resolve({ data: orgData, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/public/verify?id=VER-BBBB2222");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.found).toBe(true);
    expect(json.type).toBe("provenance");
    expect(json.record.title).toBe("Model Output v2");
    expect(json.record.ai_system).toBe("GPT-4");
  });

  it("returns found:true when incident_lock found", async () => {
    const lockData = {
      snapshot: { title: "Data Breach", impact_level: "high", status: "resolved" },
      lock_reason: "Regulatory freeze",
      locked_at: "2026-03-01T09:00:00Z",
      verification_id: "VER-CCCC3333",
      event_hash: "0xghi789",
      chain_tx_hash: null,
      chain_status: "skipped",
      organisation_id: "org-456",
      created_at: "2026-03-01T09:00:00Z",
    };

    const orgData = { name: "Lock Org" };

    let singleCallCount = 0;
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      single: vi.fn(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          // attestation: not found
          return Promise.resolve({ data: null, error: null });
        }
        if (singleCallCount === 2) {
          // provenance: not found
          return Promise.resolve({ data: null, error: null });
        }
        if (singleCallCount === 3) {
          // incident_lock: found
          return Promise.resolve({ data: lockData, error: null });
        }
        if (singleCallCount === 4) {
          // org name
          return Promise.resolve({ data: orgData, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/public/verify?id=VER-CCCC3333");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.found).toBe(true);
    expect(json.type).toBe("incident_lock");
    expect(json.record.title).toBe("Data Breach");
    expect(json.record.lock_reason).toBe("Regulatory freeze");
    expect(json.record.impact_level).toBe("high");
    expect(json.record.organisation_name).toBe("Lock Org");
  });

  it("returns found:false when nothing found", async () => {
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/public/verify?id=VER-EEEE9999");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.found).toBe(false);
  });

  it("returns found:false with unknown org name when org not found", async () => {
    const attestationData = {
      title: "Orphan Attestation",
      statement: "Statement",
      attested_at: "2026-01-15T10:00:00Z",
      verification_id: "VER-DDDD4444",
      event_hash: "0xabc",
      chain_tx_hash: null,
      chain_status: "skipped",
      organisation_id: "org-deleted",
      created_at: "2026-01-15T10:00:00Z",
    };

    let singleCallCount = 0;
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      single: vi.fn(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          return Promise.resolve({ data: attestationData, error: null });
        }
        // org not found
        return Promise.resolve({ data: null, error: null });
      }),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/public/verify?id=VER-DDDD4444");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.found).toBe(true);
    expect(json.record.organisation_name).toBe("Unknown");
  });

  it("validates id format is case-insensitive", async () => {
    // VER-abcd1234 (lowercase) should also be valid per the regex /i flag
    const mockDb: any = {
      from: vi.fn(() => mockDb),
      select: vi.fn(() => mockDb),
      eq: vi.fn(() => mockDb),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };

    (supabaseServer as any).mockReturnValue(mockDb);

    const req = mockGetRequest("/api/public/verify?id=VER-abcd1234");
    const res = await GET(req);

    // Should pass format validation (not 400)
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.found).toBe(false);
  });
});
