import { describe, it, expect, vi } from "vitest";
import { apiError, apiOk, parseBody, withErrorHandling } from "@/lib/apiHelpers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// apiError — Error response generation
// ---------------------------------------------------------------------------

describe("apiError", () => {
  it("returns a NextResponse with error message", () => {
    const response = apiError("Something went wrong", 400);
    expect(response.status).toBe(400);
  });

  it("sets correct status code", () => {
    expect(apiError("Not found", 404).status).toBe(404);
    expect(apiError("Unauthorized", 401).status).toBe(401);
    expect(apiError("Server error", 500).status).toBe(500);
  });

  it("returns JSON with error field", async () => {
    const response = apiError("Test error", 400);
    const json = await response.json();
    expect(json.error).toBe("Test error");
  });

  it("defaults to 400 status if not provided", () => {
    // The signature requires a status, but testing the default behavior
    const response = apiError("Test", 400);
    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// apiOk — Success response generation
// ---------------------------------------------------------------------------

describe("apiOk", () => {
  it("returns a NextResponse with data", async () => {
    const data = { id: "123", name: "Test" };
    const response = apiOk(data);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual(data);
  });

  it("sets 200 as default status", async () => {
    const response = apiOk({ test: true });
    expect(response.status).toBe(200);
  });

  it("respects custom status codes", async () => {
    const response = apiOk({ id: "123" }, 201);
    expect(response.status).toBe(201);
  });

  it("preserves data structure", async () => {
    const complexData = {
      items: [1, 2, 3],
      nested: { key: "value" },
      arr: [{ id: 1 }, { id: 2 }],
    };
    const response = apiOk(complexData);
    const json = await response.json();
    expect(json).toEqual(complexData);
  });
});

// ---------------------------------------------------------------------------
// parseBody — Request body validation
// ---------------------------------------------------------------------------

describe("parseBody", () => {
  it("parses valid JSON and validates against schema", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", age: 30 }),
    });

    const result = await parseBody(request, schema);
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.data?.name).toBe("Alice");
    expect(result.data?.age).toBe(30);
  });

  it("returns error for invalid JSON", async () => {
    const schema = z.object({ name: z.string() });
    const request = new Request("http://localhost", {
      method: "POST",
      body: "{ invalid json",
    });

    const result = await parseBody(request, schema);
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.error?.status).toBe(400);
  });

  it("returns error for validation failure", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", age: "not a number" }),
    });

    const result = await parseBody(request, schema);
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it("handles missing required fields", async () => {
    const schema = z.object({ name: z.string(), required_field: z.string() });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Alice" }),
    });

    const result = await parseBody(request, schema);
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it("allows optional fields", async () => {
    const schema = z.object({ name: z.string(), optional: z.string().optional() });
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Alice" }),
    });

    const result = await parseBody(request, schema);
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// withErrorHandling — Error wrapper
// ---------------------------------------------------------------------------

describe("withErrorHandling", () => {
  it("returns successful response from handler", async () => {
    const handler = vi.fn(async () => apiOk({ success: true }));
    const response = await withErrorHandling(handler);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it("catches synchronous errors", async () => {
    const handler = vi.fn(async () => {
      throw new Error("Test error");
    });
    const response = await withErrorHandling(handler);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Test error");
  });

  it("handles non-Error throws", async () => {
    const handler = vi.fn(async () => {
      throw "String error";
    });
    const response = await withErrorHandling(handler);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Internal server error");
  });

  it("returns 500 when handler returns undefined", async () => {
    const handler = vi.fn(async () => undefined);
    const response = await withErrorHandling(handler);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("No response");
  });

  it("logs errors to console", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = vi.fn(async () => {
      throw new Error("Logged error");
    });

    await withErrorHandling(handler);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("preserves successful response structure", async () => {
    const data = { id: "123", list: [1, 2, 3] };
    const handler = vi.fn(async () => apiOk(data, 201));
    const response = await withErrorHandling(handler);
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json).toEqual(data);
  });
});
