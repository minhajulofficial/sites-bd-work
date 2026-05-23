import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api/auth";
import { cloudflareErrorResponse, okJson } from "@/lib/api/responses";
import { resolveEnabledTld } from "@/lib/api/resolve-tld";
import { getCloudflareClient } from "@/lib/cloudflare/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/dns/[tldId]/zone
 *
 * Returns the Cloudflare zone metadata (id, name, status, NS list) for
 * the TLD. Used by the PR-24 TLD admin page so the operator can verify
 * the zone resolves and copy the canonical NS records.
 */
export async function GET(
  _request: Request,
  { params }: { params: { tldId: string } },
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const tld = resolveEnabledTld(params.tldId);
  if (!tld.ok) return tld.response;

  try {
    const zone = await getCloudflareClient(tld.tld.id).getZoneInfo();
    return okJson({
      tldId: tld.tld.id,
      tldName: tld.tld.name,
      zone,
    });
  } catch (e) {
    return cloudflareErrorResponse(e, tld.tld.id);
  }
}
