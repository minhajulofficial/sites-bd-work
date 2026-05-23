import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api/auth";
import {
  cloudflareErrorResponse,
  errJson,
  okJson,
} from "@/lib/api/responses";
import { resolveEnabledTld } from "@/lib/api/resolve-tld";
import { getCloudflareClient } from "@/lib/cloudflare/client";
import type {
  CFRecordType,
  PurgeOpts,
} from "@/lib/cloudflare/types";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: CFRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];

function isRecordType(v: unknown): v is CFRecordType {
  return typeof v === "string" && (ALLOWED_TYPES as string[]).includes(v);
}

interface PurgeBody {
  fullDomain: string;
  keepTypes?: CFRecordType[];
  /**
   * Optional regex *source* string applied to TXT record names that
   * should be preserved (compiled with `flags`, default `"i"`). JSON
   * cannot carry a literal RegExp so callers send it as
   * `{ keepTxtWithNameMatching: { source, flags? } }`.
   */
  keepTxtWithNameMatching?: { source: string; flags?: string };
}

function validatePurge(
  raw: unknown,
): { ok: true; body: PurgeBody } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Body must be a JSON object" };
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.fullDomain !== "string" || r.fullDomain.length === 0) {
    return { ok: false, reason: "fullDomain is required" };
  }

  let keepTypes: CFRecordType[] | undefined;
  if (r.keepTypes !== undefined) {
    if (!Array.isArray(r.keepTypes) || !r.keepTypes.every(isRecordType)) {
      return {
        ok: false,
        reason: "keepTypes must be an array of CF record types",
      };
    }
    keepTypes = r.keepTypes;
  }

  let keepTxt: { source: string; flags?: string } | undefined;
  if (r.keepTxtWithNameMatching !== undefined) {
    const k = r.keepTxtWithNameMatching;
    if (
      !k ||
      typeof k !== "object" ||
      typeof (k as { source?: unknown }).source !== "string"
    ) {
      return {
        ok: false,
        reason:
          "keepTxtWithNameMatching must be { source: string, flags?: string }",
      };
    }
    const src = (k as { source: string }).source;
    const flags = (k as { flags?: string }).flags;
    if (flags !== undefined && typeof flags !== "string") {
      return { ok: false, reason: "keepTxtWithNameMatching.flags must be string" };
    }
    keepTxt = { source: src, ...(flags !== undefined ? { flags } : {}) };
  }

  return {
    ok: true,
    body: {
      fullDomain: r.fullDomain,
      ...(keepTypes ? { keepTypes } : {}),
      ...(keepTxt ? { keepTxtWithNameMatching: keepTxt } : {}),
    },
  };
}

/**
 * POST /api/dns/[tldId]/purge
 *
 * Deletes every DNS record on this TLD's zone whose `name` exactly
 * matches `fullDomain`, except records whose `type` is in `keepTypes` or
 * TXT records whose name matches `keepTxtWithNameMatching`. Used by the
 * cleanup cron (PR-23) when a subdomain expires.
 */
export async function POST(
  request: Request,
  { params }: { params: { tldId: string } },
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const tld = resolveEnabledTld(params.tldId);
  if (!tld.ok) return tld.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errJson("invalid_body", "Body must be valid JSON", 400);
  }
  const v = validatePurge(raw);
  if (!v.ok) return errJson("invalid_body", v.reason, 400);

  const purgeOpts: PurgeOpts = {};
  if (v.body.keepTypes) purgeOpts.keepTypes = v.body.keepTypes;
  if (v.body.keepTxtWithNameMatching) {
    try {
      purgeOpts.keepTxtWithNameMatching = new RegExp(
        v.body.keepTxtWithNameMatching.source,
        v.body.keepTxtWithNameMatching.flags ?? "i",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return errJson(
        "invalid_body",
        `keepTxtWithNameMatching is not a valid regex: ${msg}`,
        400,
      );
    }
  }

  try {
    const result = await getCloudflareClient(tld.tld.id).purgeRecordsBySubdomain(
      v.body.fullDomain,
      purgeOpts,
    );
    return okJson({
      tldId: tld.tld.id,
      fullDomain: v.body.fullDomain,
      ...result,
    });
  } catch (e) {
    return cloudflareErrorResponse(e, tld.tld.id);
  }
}
