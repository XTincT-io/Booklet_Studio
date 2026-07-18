import type { Tier } from "@prisma/client";

interface TierLimits {
  maxProjects: number;
  maxStorageMB: number;
  features: string[];
}

const INDIE_ARTIST_FEATURES = ["core_fonts", "premium_fonts", "all_themes", "advanced_canvas", "hq_export", "embed_export", "social_export"];
const INDIE_LABEL_FEATURES = [...INDIE_ARTIST_FEATURES, "multi_artist", "roles", "shared_library", "scheduling", "analytics", "comments"];
const ENTERPRISE_FEATURES = [...INDIE_LABEL_FEATURES, "sso", "audit_log", "white_label", "api_access", "private_hosting"];

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  FREE: { maxProjects: 1, maxStorageMB: 250, features: ["core_fonts", "basic_themes", "basic_export"] },
  INDIE_ARTIST: { maxProjects: Infinity, maxStorageMB: 5000, features: INDIE_ARTIST_FEATURES },
  INDIE_LABEL: { maxProjects: Infinity, maxStorageMB: 50000, features: INDIE_LABEL_FEATURES },
  ENTERPRISE: { maxProjects: Infinity, maxStorageMB: Infinity, features: ENTERPRISE_FEATURES },
};

export function canCreateProject(tier: Tier, currentCount: number): boolean {
  return currentCount < TIER_LIMITS[tier].maxProjects;
}

export function hasFeature(tier: Tier, feature: string): boolean {
  return TIER_LIMITS[tier].features.includes(feature);
}
