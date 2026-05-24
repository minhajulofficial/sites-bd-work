import type {
  HostingPlansConfig,
  PremiumPlan,
  FreeOption,
  CustomOption,
} from "./types";

/**
 * Load hosting plans configuration from JSON.
 * Cached after first load — safe to call multiple times.
 */
let cachedConfig: HostingPlansConfig | null = null;

export function getHostingPlans(): HostingPlansConfig {
  if (cachedConfig) return cachedConfig;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cachedConfig = require("@/config/hostingPlans.json") as HostingPlansConfig;
  return cachedConfig;
}

export function getPremiumPlans(): PremiumPlan[] {
  return getHostingPlans().premium;
}

export function getFreeOptions(): FreeOption[] {
  return getHostingPlans().free;
}

export function getCustomOptions(): CustomOption[] {
  return getHostingPlans().custom;
}

/**
 * Find a premium plan by its id. Returns null if not found.
 */
export function findPremiumPlan(id: string): PremiumPlan | null {
  return getPremiumPlans().find((p) => p.id === id) ?? null;
}

/**
 * Validate that a hosting_plan_id exists in the premium plans config.
 * Used for server-side validation when PATCH-ing a cart item.
 */
export function isValidPremiumPlanId(id: string): boolean {
  return getPremiumPlans().some((p) => p.id === id);
}

/**
 * Validate that a free option id exists in the config.
 */
export function isValidFreeOptionId(id: string): boolean {
  return getFreeOptions().some((o) => o.id === id);
}