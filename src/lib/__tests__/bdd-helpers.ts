// src/lib/__tests__/bdd-helpers.ts
//
// BDD-style test utilities for AI-Driven BDD+ Continuous Testing.
// These helpers wrap Vitest's describe/it with semantically meaningful names
// that map to Given/When/Then and Feature/Scenario patterns.
//
// Usage:
//   import { Feature, Scenario, Given, When, Then } from "@/lib/__tests__/bdd-helpers";
//
//   Feature("Trust Exchange", () => {
//     Scenario("sharing an attestation with an external auditor", () => {
//       Given("an authenticated user with a valid organisation", () => { ... });
//       When("they share an attestation with an auditor", () => { ... });
//       Then("a verification URL is returned", () => { ... });
//     });
//   });

/**
 * Top-level feature grouping. Maps to describe() with "Feature: " prefix.
 */
export function Feature(name: string, fn: () => void): void {
  describe(`Feature: ${name}`, fn);
}

/**
 * Scenario within a feature. Maps to describe() with "Scenario: " prefix.
 */
export function Scenario(name: string, fn: () => void): void {
  describe(`Scenario: ${name}`, fn);
}

/**
 * Given step — sets up preconditions. Maps to describe() with "Given " prefix.
 * Use for grouping setup-related assertions or as a describe block.
 */
export function Given(description: string, fn: () => void): void {
  describe(`Given ${description}`, fn);
}

/**
 * When step — the action being tested. Maps to describe() with "When " prefix.
 * Use for grouping action-related test cases.
 */
export function When(description: string, fn: () => void): void {
  describe(`When ${description}`, fn);
}

/**
 * Then step — expected outcomes. Maps to it() with "Then " prefix.
 * Use for individual assertions.
 */
export function Then(description: string, fn: () => void | Promise<void>): void {
  it(`Then ${description}`, fn);
}

/**
 * And step — additional condition or assertion. Maps to it() with "And " prefix.
 * Chain after Given/When/Then for additional conditions.
 */
export function And(description: string, fn: () => void | Promise<void>): void {
  it(`And ${description}`, fn);
}

/**
 * But step — negative condition. Maps to it() with "But " prefix.
 * Use for expressing what should NOT happen.
 */
export function But(description: string, fn: () => void | Promise<void>): void {
  it(`But ${description}`, fn);
}

// ─── Assertion helpers ────────────────────────────────────────────

/**
 * Assert that an API response has a specific status code.
 */
export function expectStatus(response: Response, status: number): void {
  expect(response.status).toBe(status);
}

/**
 * Assert that an API response body contains expected fields.
 */
export async function expectBody(
  response: Response,
  expected: Record<string, unknown>
): Promise<void> {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}

/**
 * Assert that an API response is an error with a specific message pattern.
 */
export async function expectError(
  response: Response,
  status: number,
  messagePattern?: string | RegExp
): Promise<void> {
  expect(response.status).toBe(status);
  if (messagePattern) {
    const body = await response.json();
    if (typeof messagePattern === "string") {
      expect(body.error).toContain(messagePattern);
    } else {
      expect(body.error).toMatch(messagePattern);
    }
  }
}
