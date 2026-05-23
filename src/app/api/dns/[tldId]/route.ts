import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api/auth";
import {
  cloudflareErrorResponse,
  errJson,
  okJson,
} from "@/lib/api/responses";
import { resolveEnabledTld } from "@/lib/api/resolve-tld";
import { getCloudflareClient } from "@/lib/cloudflare/client";
import type { CFRecordType } from "@/lib/cloudflare/types";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: CFRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];

function parseRecordType(value: string | null): CFRecordType | null {
  if (!value) return null;
  const v = value.toUpperCase();
  return (ALLOWED_TYPES as string[]).includes(v) ? (v as CFRecordType) : null;
}

/**
 * GET /api/dns/[tldId]
 *
 * Lists DNS records for the entire zone bound to this TLD. Admin-only —
 * a user-scoped view of a single subdomain lives under
 * `/api/dns/[tldId]/subdomain/[name]`.
 *
 * Query params:
 *   - `name`     (optional)  — exact-name filter
 *   - `type`     (optional)  — one of `A | AAAA | CNAME | MX | TXT | NS`
 *   - `per_page` (optional, default 100)
 *   - `page`     (optional, default 1)
 */
export async function GET(
  request: Request,
  { params }: { params: { tldId: string } },
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const tld = resolveEnabledTld(params.tldId);
  if (!tld.ok) return tld.response;

  const url = new URL(request.url);
  const sp = url.searchParams;

  const typeParam = sp.get("type");
  if (typeParam && !parseRecordType(typeParam)) {
    return errJson(
      "invalid_type",
      `Unsupported record type "${typeParam}"`,
      400,
    );
  }
  const perPageRaw = sp.get("per_page");
  const pageRaw = sp.get("page");
  const per_page = perPageRaw ? Number(perPageRaw) : 100;
  const page = pageRaw ? Number(pageRaw) : 1;
  if (!Number.isFinite(per_page) || per_page <= 0 || per_page > 100) {
    return errJson("invalid_per_page", "per_page must be 1..100", 400);
  }
  if (!Number.isFinite(page) || page <= 0) {
    return errJson("invalid_page", "page must be >= 1", 400);
  }

  try {
    const client = getCloudflareClient(tld.tld.id);
    const records = await client.listDnsRecords({
      name: sp.get("name") ?? undefined,
      type: parseRecordType(typeParam) ?? undefined,
      per_page,
      page,
    });
    return okJson({
      tldId: tld.tld.id,
      tldName: tld.tld.name,
      page,
      per_page,
      records,
    });
  } catch (e) {
    return cloudflareErrorResponse(e, tld.tld.id);
  }
}
