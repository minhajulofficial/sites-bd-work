/**
 * Hosting plan types driven by `src/config/hostingPlans.json`.
 *
 * The architectural rule (PRD §3.3) requires that all hosting plan
 * and free option lists are rendered dynamically from the JSON config
 * — no hardcoding in JSX. New plans are addable by editing the JSON only.
 */

export type HostingPlanCategory = "premium" | "free" | "custom";

export interface PremiumPlan {
  id: string;
  name: string;
  yearlyBDT: number;
  provider: string;
  specs: string;
}

export interface FreeOption {
  id: string;
  name: string;
}

export interface CustomOption {
  id: string;
  name: string;
}

export type HostingPlanEntry =
  | { category: "premium"; plan: PremiumPlan }
  | { category: "free"; plan: FreeOption }
  | { category: "custom"; option: CustomOption };

/** Root shape of hostingPlans.json */
export interface HostingPlansConfig {
  premium: PremiumPlan[];
  free: FreeOption[];
  custom: CustomOption[];
}