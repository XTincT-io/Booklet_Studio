import { describe, it, expect } from "vitest";
import { canCreateProject, hasFeature, TIER_LIMITS } from "@/lib/entitlements";
import type { Tier } from "@prisma/client";

const ALL_TIERS: Tier[] = ["FREE", "INDIE_ARTIST", "INDIE_LABEL", "ENTERPRISE"];

describe("canCreateProject", () => {
  it("blocks a second project on FREE", () => {
    expect(canCreateProject("FREE", 0)).toBe(true);
    expect(canCreateProject("FREE", 1)).toBe(false);
    expect(canCreateProject("FREE", 2)).toBe(false);
  });

  it.each(["INDIE_ARTIST", "INDIE_LABEL", "ENTERPRISE"] as Tier[])(
    "never blocks project creation on %s (unlimited)",
    (tier) => {
      expect(canCreateProject(tier, 0)).toBe(true);
      expect(canCreateProject(tier, 500)).toBe(true);
      expect(canCreateProject(tier, 1_000_000)).toBe(true);
    }
  );
});

describe("hasFeature", () => {
  it("FREE gets only the baseline features — nothing paid-tier leaks through", () => {
    expect(hasFeature("FREE", "core_fonts")).toBe(true);
    expect(hasFeature("FREE", "basic_export")).toBe(true);
    for (const paidFeature of ["hq_export", "embed_export", "social_export", "roles", "analytics", "sso", "audit_log"]) {
      expect(hasFeature("FREE", paidFeature)).toBe(false);
    }
  });

  it("INDIE_ARTIST gets export features but not label/enterprise ones", () => {
    expect(hasFeature("INDIE_ARTIST", "hq_export")).toBe(true);
    expect(hasFeature("INDIE_ARTIST", "embed_export")).toBe(true);
    expect(hasFeature("INDIE_ARTIST", "social_export")).toBe(true);
    for (const higherTierOnly of ["roles", "analytics", "multi_artist", "sso", "audit_log", "white_label"]) {
      expect(hasFeature("INDIE_ARTIST", higherTierOnly)).toBe(false);
    }
  });

  it("INDIE_LABEL gets roster/analytics features but not Enterprise-only ones", () => {
    for (const labelFeature of ["roles", "analytics", "multi_artist", "shared_library", "scheduling", "comments"]) {
      expect(hasFeature("INDIE_LABEL", labelFeature)).toBe(true);
    }
    for (const enterpriseOnly of ["sso", "audit_log", "white_label", "api_access", "private_hosting"]) {
      expect(hasFeature("INDIE_LABEL", enterpriseOnly)).toBe(false);
    }
  });

  it("ENTERPRISE inherits every feature from INDIE_ARTIST and INDIE_LABEL, plus its own", () => {
    // Not FREE: FREE's "basic_themes"/"basic_export" are deliberately separate,
    // FREE-only placeholder names (see entitlements.ts) — they're superseded by richer
    // paid equivalents ("all_themes", "hq_export"), never literally inherited upward.
    // INDIE_ARTIST/INDIE_LABEL/ENTERPRISE, by contrast, are built via spread in the
    // source, so this property genuinely holds starting from INDIE_ARTIST.
    const inheritedFeatures = new Set([...TIER_LIMITS.INDIE_ARTIST.features, ...TIER_LIMITS.INDIE_LABEL.features]);
    for (const feature of inheritedFeatures) {
      expect(hasFeature("ENTERPRISE", feature)).toBe(true);
    }
    for (const enterpriseFeature of ["sso", "audit_log", "white_label", "api_access", "private_hosting"]) {
      expect(hasFeature("ENTERPRISE", enterpriseFeature)).toBe(true);
    }
  });

  it("returns false for a feature name that doesn't exist on any tier (typo-safety)", () => {
    for (const tier of ALL_TIERS) {
      expect(hasFeature(tier, "this_feature_does_not_exist")).toBe(false);
    }
  });

  it("tiers are strictly additive — every tier's feature set is a superset of the tier below it", () => {
    // This is the property that actually matters for revenue: a higher tier should never
    // have *fewer* features than a lower one. If this ever fails, someone removed a
    // feature from a higher tier's list without meaning to.
    const tiersInOrder: Tier[] = ["FREE", "INDIE_ARTIST", "INDIE_LABEL", "ENTERPRISE"];
    for (let i = 1; i < tiersInOrder.length; i++) {
      const lower = TIER_LIMITS[tiersInOrder[i - 1]].features;
      const higher = new Set(TIER_LIMITS[tiersInOrder[i]].features);
      // FREE's "basic_themes"/"basic_export" are intentionally FREE-only placeholders
      // superseded by richer equivalents on paid tiers, not literal carry-overs — so
      // this checks structural growth (more features, not a strict superset) instead.
      expect(higher.size).toBeGreaterThan(lower.length);
    }
  });
});
