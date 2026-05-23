import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api/auth";
import { cloudflareErrorResponse, okJson } from "@/lib/api/responses";
import { resolveEnabledTld } from "@/lib/api/resolve-tld";
import { getCloudflareClient } from "@/lib/cloudflare/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/dns/[tldId]/subdomain/[name]
 *
 * Convenience: list every record on this TLD's zone whose `name` exactly
 * matches `<name>.<tldName>`. Pages through Cloudflare's 100/page
 * pagination internally. PR-13's domain detail page reads from here.
 */
export async function GET(
  _request: Request,
  { params }: { params: { tldId: string; name: string } },
): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const tld = resolveEnabledTld(params.tldId);
  if (!tld.ok) return tld.response;

  const fullDomain = `${params.name.toLowerCase()}.${tld.tld.name}`;

  try {
    const records = await getCloudflareClient(tld.tld.id).listSubdomainRecords(
      fullDomain,
    );
    return okJson({
      tldId: tld.tld.id,
      tldName: tld.tld.name,
      subdomain: params.name,
      fullDomain,
      records,
    });
  } catch (e) {
    return cloudflareErrorResponse(e, tld.tld.id);
  }
}
