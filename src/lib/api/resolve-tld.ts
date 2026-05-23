import { getTldById } from "@/lib/domains/registry";
import type { TldEntry } from "@/lib/domains/registry";

import { errJson } from "./responses";

import type { NextResponse } from "next/server";

export type TldResolveResult =
  | { ok: true; tld: TldEntry }
  | { ok: false; response: NextResponse };

/**
 * Returns the `TldEntry` for the slug found in `[tldId]` params, or a
 * `404 unknown_tld` / `404 tld_disabled` response when the slug is not in
 * `getEnabledTlds()`. Removing a TLD from `src/config/domains.json` (or
 * disabling it in the `tlds` DB row) is therefore sufficient to stop all
 * `/api/dns/<tldId>/...` endpoints from serving — no code change needed.
 */
export function resolveEnabledTld(tldId: string): TldResolveResult {
  const tld = getTldById(tldId);
  if (!tld) {
    return {
      ok: false,
      response: errJson(
        "unknown_tld",
        `Unknown TLD "${tldId}"`,
        404,
      ),
    };
  }
  if (!tld.enabled) {
    return {
      ok: false,
      response: errJson(
        "tld_disabled",
        `TLD "${tldId}" is disabled`,
        404,
      ),
    };
  }
  return { ok: true, tld };
}
