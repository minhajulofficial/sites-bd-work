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
  CreateDnsInput,
} from "@/lib/cloudflare/types";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: CFRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];

function isRecordType(v: unknown): v is CFRecordType {
  return typeof v === "string" && (ALLOWED_TYPES as string[]).includes(v);
}

function validateCreate(
  raw: unknown,
): { ok: true; input: CreateDnsInput } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Body must be a JSON object" };
  }
  const r = raw as Record<string, unknown>;
  if (!isRecordType(r.type)) {
    return { ok: false, reason: "type must be one of A|AAAA|CNAME|MX|TXT|NS" };
  }
  if (typeof r.name !== "string" || r.name.length === 0) {
    return { ok: false, reason: "name is required" };
  }
  if (typeof r.content !== "string" || r.content.length === 0) {
    return { ok: false, reason: "content is required" };
  }
  if (typeof r.ttl !== "number" || r.ttl < 1) {
    return { ok: false, reason: "ttl must be a positive number" };
  }
  if (r.priority !== undefined && typeof r.priority !== "number") {
    return { ok: false, reason: "priority must be a number when set" };
  }
  if (r.proxied !== undefined && typeof r.proxied !== "boolean") {
    return { ok: false, reason: "proxied must be a boolean when set" };
  }
  return {
    ok: true,
    input: {
      type: r.type,
      name: r.name,
      content: r.content,
      ttl: r.ttl,
      ...(r.priority !== undefined ? { priority: r.priority as number } : {}),
      ...(r.proxied !== undefined ? { proxied: r.proxied as boolean } : {}),
    },
  };
}

/**
 * GET /api/dns/[tldId]/records
 *
 * Same listing surface as `GET /api/dns/[tldId]`, with the same query
 * params. Kept as a sibling route so callers can use the more RESTful
 * `/records` path for "I want the collection" semantics and reserve the
 * bare `/[tldId]` route for zone-scoped operations later.
 */
export async function GET(
  request: Request,
  { params }: { params: { tldId: string } },
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const tld = resolveEnabledTld(params.tldId);
  if (!tld.ok) return tld.response;

  const sp = new URL(request.url).searchParams;
  const typeParam = sp.get("type");
  if (typeParam && !isRecordType(typeParam.toUpperCase())) {
    return errJson(
      "invalid_type",
      `Unsupported record type "${typeParam}"`,
      400,
    );
  }
  const per_page = sp.get("per_page") ? Number(sp.get("per_page")) : 100;
  const page = sp.get("page") ? Number(sp.get("page")) : 1;
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
      type: typeParam
        ? (typeParam.toUpperCase() as CFRecordType)
        : undefined,
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

/**
 * POST /api/dns/[tldId]/records
 *
 * Create a DNS record on the TLD's zone. Body matches `CreateDnsInput`.
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
  const v = validateCreate(raw);
  if (!v.ok) return errJson("invalid_body", v.reason, 400);

  try {
    const client = getCloudflareClient(tld.tld.id);
    const created = await client.createDnsRecord(v.input);
    return okJson({ record: created }, { status: 201 });
  } catch (e) {
    return cloudflareErrorResponse(e, tld.tld.id);
  }
}
