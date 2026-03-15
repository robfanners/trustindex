// src/lib/__tests__/bdd-example.test.ts
//
// Example: AI-Driven BDD+ Continuous Testing pattern.
// This test demonstrates the methodology using the tier system.
// Use this as a reference when writing new tests.

import { Feature, Scenario, Given, When, Then, And, But } from "./bdd-helpers";
import { planToTier, hasTierAccess } from "@/lib/tiers";

Feature("Tier-Based Access Control", () => {
  Scenario("a free-tier user exploring the platform", () => {
    // Given
    let userPlan: string;
    let userTier: string;

    beforeEach(() => {
      // Given a user on the free explorer plan
      userPlan = "explorer";
      userTier = planToTier(userPlan);
    });

    Then("they are assigned to the Core tier", () => {
      expect(userTier).toBe("Core");
    });

    And("they can access Core features", () => {
      expect(hasTierAccess(userPlan, "Core")).toBe(true);
    });

    But("they cannot access Assure monitoring features", () => {
      expect(hasTierAccess(userPlan, "Assure")).toBe(false);
    });

    But("they cannot access Verify proof features", () => {
      expect(hasTierAccess(userPlan, "Verify")).toBe(false);
    });
  });

  Scenario("a pro user managing AI governance", () => {
    let userPlan: string;
    let userTier: string;

    beforeEach(() => {
      // Given a user on the pro plan
      userPlan = "pro";
      userTier = planToTier(userPlan);
    });

    Then("they are assigned to the Assure tier", () => {
      expect(userTier).toBe("Assure");
    });

    And("they can access Core features", () => {
      expect(hasTierAccess(userPlan, "Core")).toBe(true);
    });

    And("they can access Assure monitoring features", () => {
      expect(hasTierAccess(userPlan, "Assure")).toBe(true);
    });

    But("they cannot access Verify proof features", () => {
      expect(hasTierAccess(userPlan, "Verify")).toBe(false);
    });
  });

  Scenario("an enterprise user with full access", () => {
    let userPlan: string;
    let userTier: string;

    beforeEach(() => {
      // Given a user on the enterprise plan
      userPlan = "enterprise";
      userTier = planToTier(userPlan);
    });

    Then("they are assigned to the Verify tier", () => {
      expect(userTier).toBe("Verify");
    });

    And("they can access all three tiers", () => {
      expect(hasTierAccess(userPlan, "Core")).toBe(true);
      expect(hasTierAccess(userPlan, "Assure")).toBe(true);
      expect(hasTierAccess(userPlan, "Verify")).toBe(true);
    });
  });

  Scenario("handling unknown or missing plan data", () => {
    Then("null plan defaults to Core tier", () => {
      expect(planToTier(null as any)).toBe("Core");
    });

    And("undefined plan defaults to Core tier", () => {
      expect(planToTier(undefined as any)).toBe("Core");
    });

    And("unknown plan string defaults to Core tier", () => {
      expect(planToTier("nonexistent" as any)).toBe("Core");
    });
  });
});
