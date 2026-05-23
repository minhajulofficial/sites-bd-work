import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { errJson, okJson } from "@/lib/api/responses";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  requireProfileVerified,
} from "@/lib/auth/session";
import { CartStoreError, mergeGuestCartIntoUser } from "@/lib/cart/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  tldId: z.string().min(1).max(64),
  name: z
    .string()
    .min(2)
    .max(30)
    .regex(
      /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/,
      "Name must match /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/",
    ),
  fullDomain: z.string().min(3).max(128),
  hostingType: z
    .enum(["premium", "free", "custom_ns", "custom_ip"])
    .nullable()
    .optional(),
  hostingPlanId: z.string().min(1).max(64).nullable().optional(),
  customNsValues: z.array(z.string().max(255)).max(8).nullable().optional(),
  customIpValue: z.string().max(45).nullable().optional(),
  addons: z.array(z.record(z.unknown())).max(32).optional(),
});

const bodySchema = z.object({
  items: z.array(itemSchema).max(50),
});

/**
 * POST /api/cart/merge-guest
 *
 * Called by the client immediately after sign-in / registration
 * completes. The client posts its `sessionStorage.guestCart` payload
 * here; the server inserts every item that isn't already in the user's
 * DB cart, applying the PRD §3.2 dedupe rule (DB wins on conflict).
 *
 * Idempotent — calling it twice with the same payload doesn't
 * duplicate rows, because the second call sees the merged rows as
 * "existing" and skips them.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await requireProfileVerified();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return errJson(
        "unauthenticated",
        "Sign in to merge your guest cart",
        401,
      );
    }
    if (e instanceof AccountSuspendedError) {
      return errJson("account_suspended", "Account is suspended", 403);
    }
    if (e instanceof ProfileIncompleteError) {
      return errJson(
        "profile_incomplete",
        "Complete your profile before merging cart",
        403,
      );
    }
    throw e;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errJson("invalid_body", "Body must be valid JSON", 400);
  }

  let body;
  try {
    body = bodySchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      return errJson(
        "invalid_body",
        e.issues[0]?.message ?? "Invalid request body",
        400,
      );
    }
    throw e;
  }

  try {
    const result = await mergeGuestCartIntoUser(ctx.user.id, body.items);
    return okJson({
      items: result.items,
      mergedCount: result.mergedCount,
      skippedCount: result.skipped,
    });
  } catch (e) {
    if (e instanceof CartStoreError) {
      return errJson(e.code, e.message, e.status);
    }
    console.error("[api/cart/merge-guest POST] unhandled error", e);
    return errJson("internal_error", "Internal server error", 500);
  }
}
