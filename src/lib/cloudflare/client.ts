import "server-only";

import {
  getEnabledTlds,
  getTldById,
  getTldEnv,
} from "@/lib/domains/registry";

import {
  CFApiError,
  CFDnsRecord,
  CFRecordType,
  CFZone,
  CloudflareClient,
  CloudflareError,
  CreateDnsInput,
  ListDnsRecordsOpts,
  PurgeOpts,
  UpdateDnsInput,
} from "./types";

const CF_BASE_URL = "https://api.cloudflare.com/client/v4";

/** Exponential backoff schedule (ms) for 429 / 5xx / network failures. */
const RETRY_DELAYS_MS = [200, 600, 1800];

interface CFEnvelope<T> {
  success: boolean;
  errors: CFApiError[];
  messages: unknown[];
  result: T;
  result_info?: {
    total_count?: number;
    page?: number;
    per_page?: number;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function buildClient(tldId: string): CloudflareClient {
  const { apiToken, zoneId, zoneName } = getTldEnv(tldId);

  /**
   * Performs ONE Cloudflare API request with retry/backoff. Never logs the
   * token. Throws `CloudflareError` on non-2xx after retries are exhausted.
   */
  async function cfFetch<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${CF_BASE_URL}${path}`;
    const method = (init.method ?? "GET").toUpperCase();

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          method,
          headers: {
            ...(init.headers ?? {}),
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        });
        const text = await res.text();
        let envelope: CFEnvelope<T> | undefined;
        try {
          envelope = JSON.parse(text) as CFEnvelope<T>;
        } catch {
          envelope = undefined;
        }

        if (
          res.ok &&
          envelope &&
          envelope.success &&
          envelope.result !== undefined
        ) {
          return envelope.result;
        }

        const errors = envelope?.errors ?? [];
        const message =
          errors[0]?.message ?? `Cloudflare returned HTTP ${res.status}`;
        console.error(
          `[cloudflare ${tldId}] ${method} ${path} -> ${res.status} ${message}`,
        );

        if (shouldRetry(res.status) && attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new CloudflareError(tldId, res.status, errors, message);
      } catch (e) {
        if (e instanceof CloudflareError) {
          throw e;
        }
        // Network / fetch error. Retry, then surface as CloudflareError.
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(
          `[cloudflare ${tldId}] network error on ${method} ${path}: ${msg}` +
            (attempt < RETRY_DELAYS_MS.length
              ? ` (retry ${attempt + 1}/${RETRY_DELAYS_MS.length})`
              : ""),
        );
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new CloudflareError(tldId, 0, [], `network error: ${msg}`);
      }
    }

    // Unreachable, but keeps TS happy.
    throw new CloudflareError(tldId, 0, [], "retry loop exited unexpectedly");
  }

  const client: CloudflareClient = {
    tldId,
    zoneId,
    zoneName,

    async listDnsRecords(opts: ListDnsRecordsOpts = {}): Promise<CFDnsRecord[]> {
      const path = `/zones/${zoneId}/dns_records${buildQuery({
        name: opts.name,
        type: opts.type,
        per_page: opts.per_page ?? 100,
        page: opts.page ?? 1,
      })}`;
      return cfFetch<CFDnsRecord[]>(path, { method: "GET" });
    },

    async getDnsRecord(id: string): Promise<CFDnsRecord> {
      return cfFetch<CFDnsRecord>(`/zones/${zoneId}/dns_records/${id}`, {
        method: "GET",
      });
    },

    async createDnsRecord(input: CreateDnsInput): Promise<CFDnsRecord> {
      return cfFetch<CFDnsRecord>(`/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    async updateDnsRecord(
      id: string,
      input: UpdateDnsInput,
    ): Promise<CFDnsRecord> {
      return cfFetch<CFDnsRecord>(`/zones/${zoneId}/dns_records/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },

    async deleteDnsRecord(id: string): Promise<{ id: string }> {
      return cfFetch<{ id: string }>(`/zones/${zoneId}/dns_records/${id}`, {
        method: "DELETE",
      });
    },

    async getZoneInfo(): Promise<CFZone> {
      const zone = await cfFetch<{
        id: string;
        name: string;
        status: string;
        name_servers?: string[];
      }>(`/zones/${zoneId}`, { method: "GET" });
      return {
        id: zone.id,
        name: zone.name,
        status: zone.status,
        name_servers: zone.name_servers ?? [],
      };
    },

    async listSubdomainRecords(subdomain: string): Promise<CFDnsRecord[]> {
      // Cloudflare's list endpoint filters by exact name. Page through to
      // collect every record matching `subdomain` exactly (e.g. records
      // with name="bdshop.sites.bd"). Subrecords like
      // "www.bdshop.sites.bd" are out of scope for the per-subdomain
      // purge flow — they're owned by the user via their own DNS UI.
      const records: CFDnsRecord[] = [];
      let page = 1;
      // Defensive cap to avoid an unbounded loop on a misbehaving zone.
      while (page < 50) {
        const batch = await this.listDnsRecords({
          name: subdomain,
          per_page: 100,
          page,
        });
        records.push(...batch);
        if (batch.length < 100) break;
        page++;
      }
      return records;
    },

    async purgeRecordsBySubdomain(
      fullDomain: string,
      opts: PurgeOpts = {},
    ): Promise<{ deletedIds: string[] }> {
      const records = await this.listSubdomainRecords(fullDomain);
      const keepTypes = new Set<CFRecordType>(opts.keepTypes ?? []);
      const keepTxtRe = opts.keepTxtWithNameMatching;

      const deletedIds: string[] = [];
      for (const r of records) {
        if (keepTypes.has(r.type)) continue;
        if (r.type === "TXT" && keepTxtRe && keepTxtRe.test(r.name)) continue;
        await this.deleteDnsRecord(r.id);
        deletedIds.push(r.id);
      }
      return { deletedIds };
    },
  };

  return client;
}

/**
 * Per-process client cache keyed by `tldId`. Reuses one
 * `CloudflareClient` per TLD across requests so connection pools and the
 * env-var lookup don't reinitialise on every API call. Each TLD gets its
 * own bound zone id + bearer token — clients are NOT shared between TLDs.
 */
const clientCache = new Map<string, CloudflareClient>();

/**
 * Returns a Cloudflare client bound to ONE specific TLD zone. Throws if
 * the TLD is unknown or disabled. The required env vars
 * (`CF_<PREFIX>_API_TOKEN`, `CF_<PREFIX>_ZONE_ID`, `CF_<PREFIX>_ZONE_NAME`)
 * are read lazily via `getTldEnv()` so the cache only contains clients
 * for TLDs whose creds actually exist.
 */
export function getCloudflareClient(tldId: string): CloudflareClient {
  const cached = clientCache.get(tldId);
  if (cached) return cached;

  const tld = getTldById(tldId);
  if (!tld) {
    throw new Error(`[cloudflare] Unknown TLD id: "${tldId}"`);
  }
  if (!tld.enabled) {
    throw new Error(`[cloudflare] TLD "${tldId}" is disabled`);
  }

  const client = buildClient(tldId);
  clientCache.set(tldId, client);
  return client;
}

/** Returns one client per ENABLED TLD. Used by multi-TLD search + crons. */
export function getAllCloudflareClients(): CloudflareClient[] {
  return getEnabledTlds().map((tld) => getCloudflareClient(tld.id));
}

/** Test hook — clears the per-process cache. Not exported from index. */
export function __resetCloudflareClientsForTests(): void {
  clientCache.clear();
}
