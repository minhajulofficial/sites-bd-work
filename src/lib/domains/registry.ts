import domainsConfig from "@/config/domains.json";

/**
 * Single source of truth for the multi-TLD parent domain registry.
 *
 * Every DNS / search / admin module MUST import from this file rather than
 * reading `process.env.CF_*` directly so that adding a new parent domain is
 * always a config-only change (edit `domains.json` + add a matching env-var
 * set; no code changes elsewhere).
 */
export type TldEntry = {
  id: string;
  name: string;
  enabled: boolean;
  envPrefix: string;
  label: string;
  order: number;
  isPrimary: boolean;
};

export type TldEnv = {
  apiToken: string;
  zoneId: string;
  zoneName: string;
};

type DomainsConfig = { domains: TldEntry[] };

const config = domainsConfig as DomainsConfig;

export function getAllTlds(): TldEntry[] {
  return [...config.domains].sort((a, b) => a.order - b.order);
}

export function getEnabledTlds(): TldEntry[] {
  return getAllTlds().filter((tld) => tld.enabled);
}

export function getTldById(id: string): TldEntry | null {
  return getAllTlds().find((tld) => tld.id === id) ?? null;
}

export function getTldByName(name: string): TldEntry | null {
  return getAllTlds().find((tld) => tld.name === name) ?? null;
}

export function getPrimaryTld(): TldEntry {
  const primary = getEnabledTlds().find((tld) => tld.isPrimary);
  if (primary) return primary;
  const fallback = getEnabledTlds()[0];
  if (!fallback) {
    throw new Error(
      "[domains/registry] No enabled TLDs configured in src/config/domains.json",
    );
  }
  return fallback;
}

/**
 * Reads the per-TLD Cloudflare credentials from `process.env`, using the
 * `envPrefix` declared in `domains.json`. Throws a descriptive error if any
 * of the three required env vars are missing so server-side callers fail
 * fast at request time rather than silently mis-routing DNS writes.
 */
export function getTldEnv(id: string): TldEnv {
  const tld = getTldById(id);
  if (!tld) {
    throw new Error(`[domains/registry] Unknown TLD id: "${id}"`);
  }
  const apiToken = process.env[`${tld.envPrefix}_API_TOKEN`];
  const zoneId = process.env[`${tld.envPrefix}_ZONE_ID`];
  const zoneName = process.env[`${tld.envPrefix}_ZONE_NAME`];
  const missing = [
    !apiToken && `${tld.envPrefix}_API_TOKEN`,
    !zoneId && `${tld.envPrefix}_ZONE_ID`,
    !zoneName && `${tld.envPrefix}_ZONE_NAME`,
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(
      `[domains/registry] Missing env vars for TLD "${tld.name}": ${missing.join(", ")}`,
    );
  }
  return { apiToken: apiToken!, zoneId: zoneId!, zoneName: zoneName! };
}
