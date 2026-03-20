import { vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/** Create a mock NextRequest for GET */
export function mockGetRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

/** Create a mock NextRequest for POST */
export function mockPostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Create a mock NextRequest for PATCH */
export function mockPatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Standard mock for authorized requireTier response */
export const mockAuthorized = {
  authorized: true as const,
  userId: "user-123",
  plan: "enterprise",
  orgId: "org-456",
};

/** Standard mock for unauthorized (not logged in) */
export const mockUnauthorized = {
  authorized: false as const,
  response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
};

/** Create a chainable Supabase mock that simulates .from().select().eq().single() etc. */
export function createMockSupabase(returnData: unknown = null, returnError: unknown = null) {
  const chainable: Record<string, unknown> = {
    from: vi.fn(() => chainable),
    select: vi.fn(() => chainable),
    insert: vi.fn(() => chainable),
    update: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    gte: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    range: vi.fn(() => Promise.resolve({ data: returnData, error: returnError, count: Array.isArray(returnData) ? returnData.length : returnData ? 1 : 0 })),
    single: vi.fn(() => Promise.resolve({ data: returnData, error: returnError, count: Array.isArray(returnData) ? returnData.length : returnData ? 1 : 0 })),
  };
  return chainable;
}
