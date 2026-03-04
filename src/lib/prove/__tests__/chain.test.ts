import { describe, it, expect } from "vitest";
import {
  hashPayload,
  generateVerificationId,
  isChainEnabled,
} from "@/lib/prove/chain";

// ---------------------------------------------------------------------------
// hashPayload
// ---------------------------------------------------------------------------
describe("hashPayload", () => {
  it("returns a string starting with 0x", () => {
    const hash = hashPayload({ foo: "bar" });
    expect(hash.startsWith("0x")).toBe(true);
  });

  it("returns a 66-character string (0x + 64 hex chars)", () => {
    const hash = hashPayload({ test: 123 });
    expect(hash).toHaveLength(66);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is deterministic — same input always produces same output", () => {
    const input = { action: "approve", id: "abc-123" };
    const hash1 = hashPayload(input);
    const hash2 = hashPayload(input);
    expect(hash1).toBe(hash2);
  });

  it("key order does not matter (sorted internally)", () => {
    const hashA = hashPayload({ b: 2, a: 1 });
    const hashB = hashPayload({ a: 1, b: 2 });
    expect(hashA).toBe(hashB);
  });

  it("different inputs produce different hashes", () => {
    const hash1 = hashPayload({ value: "alpha" });
    const hash2 = hashPayload({ value: "beta" });
    expect(hash1).not.toBe(hash2);
  });
});

// ---------------------------------------------------------------------------
// generateVerificationId
// ---------------------------------------------------------------------------
describe("generateVerificationId", () => {
  it("returns a string matching VER-[A-F0-9]{8} pattern", () => {
    const id = generateVerificationId({ event: "test" });
    expect(id).toMatch(/^VER-[A-F0-9]{8}$/);
  });

  it("is deterministic — same input always produces same ID", () => {
    const input = { event: "approval", ref: "xyz" };
    const id1 = generateVerificationId(input);
    const id2 = generateVerificationId(input);
    expect(id1).toBe(id2);
  });

  it("different inputs produce different IDs", () => {
    const id1 = generateVerificationId({ type: "a" });
    const id2 = generateVerificationId({ type: "b" });
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// isChainEnabled
// ---------------------------------------------------------------------------
describe("isChainEnabled", () => {
  it("returns false when env vars are not set", () => {
    // In test environment, chain env vars should not be configured
    expect(isChainEnabled()).toBe(false);
  });
});
