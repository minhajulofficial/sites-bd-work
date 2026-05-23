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
  UpdateDnsInput,
} from "@/lib/cloudflare/types";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: CFRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];

function isRecordType(v: unknown): v is CFRecordType {
  return typeof v === "string" && (ALLOWED_TYPES as string[]).includes(v);
}

function validateUpdate(
  raw: unknown,
): { ok: true; input: UpdateDnsInput } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "Body must be a JSON object" };
  }
  const r = raw as Record<string, unknown>;
  const out: UpdateDnsInput = {};
  if (r.type !== undefined) {
    if (!isRecordType(r.type)) {
      return { ok: false, reason: "type must be one of A|AAAA|CNAME|MX|TXT|NS" };
    }
    out.type = r.type;
  }
  if (r.name !== undefined) {
    if (typeof r.name !== "string" || r.name.length === 0) {
      return { ok: false, reason: "name must be a non-empty string" };
    }
    out.name = r.name;
  }
  if (r.content !== undefined) {
    if (typeof r.content !== "string" || r.content.length === 0) {
      return { ok: false, reason: "content must be a non-empty string" };
    }
    out.content = r.content;
  }
  if (r.ttl !== undefined) {
    if (typeof r.ttl !== "number" || r.ttl < 1) {
      return { ok: false, reason: "ttl must be a positive number" };
    }
    out.ttl = r.ttl;
  }
  if (r.priority !== undefined) {
    if (typeof r.priority !== "number") {
      return { ok: false, reason: "priority must be a number" };
    }
    out.priority = r.priority;
  }
  if (r.proxied !== undefined) {
    if (typeof r.proxied !== "boolean") {
      return { ok: false, reason: "proxied must be a boolean" };
    }
    out.proxied = r.proxied;
  }
  if (Object.keys(out).length === 0) {
    return { ok: false, reason: "At least one updatable field is required" };
  }
  return { ok: true, input: out };
}

/** GET /api/dns/[tldId]/records/[id] — fetch one record. */
export async function GET(
  _request: Request,
  { params }: { params: { tldId: string; id: string } },
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const tld = resolveEnabledTld(params.tldId);
  if (!tld.ok) return tld.response;

  try {
    const record = await getCloudflareClient(tld.tld.id).getDnsRecord(params.id);
    return okJson({ record });
  } catch (e) {
    return cloudflareErrorResponse(e, tld.tld.id);
  }
}

/** PATCH /api/dns/[tldId]/records/[id] — partial update of one record. */
export async function PATCH(
  request: Request,
  { params }: { params: { tldId: string; id: string } },
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
  const v = validateUpdate(raw);
  if (!v.ok) return errJson("invalid_body", v.reason, 400);

  try {
    const updated = await getCloudflareClient(tld.tld.id).updateDnsRecord(
      params.id,
      v.input,
    );
    return okJson({ record: updated });
  } catch (e) {
    return cloudflareErrorResponse(e, tld.tld.id);
  }
}

/** DELETE /api/dns/[tldId]/records/[id] — remove one record. */
export async function DELETE(
  _request: Request,
  { params }: { params: { tldId: string; id: string } },
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const tld = resolveEnabledTld(params.tldId);
  if (!tld.ok) return tld.response;

  try {
    const deleted = await getCloudflareClient(tld.tld.id).deleteDnsRecord(
      params.id,
    );
    return okJson({ deleted });
  } catch (e) {
    return cloudflareErrorResponse(e, tld.tld.id);
  }
}
