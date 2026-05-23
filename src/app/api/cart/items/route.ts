import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { errJson, okJson } from "@/lib/api/responses";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  requireProfileVerified,
} from "@/lib/auth/session";
import { CartStoreError, addItemForUser } from "@/lib/cart/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mirrors `CartItemInput` from `@/lib/cart/types`. */
const bodySchema = z.object({
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
  addons: z
    .array(z.record(z.unknown()))
    .max(32)
    .optional(),
});

/**
 * POST /api/cart/items
 *
 * Add one `(tldId, name)` pair to the logged-in user's cart. Returns
 * 409 if the same pair is already present (per PRD §3.2 — the same
 * name on a different TLD is fine, so the constraint is on the pair,
 * not the name alone).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await requireProfileVerified();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return errJson(
        "unauthenticated",
        "Sign in to add items to your cart",
        401,
      );
    }
    if (e instanceof AccountSuspendedError) {
      return errJson("account_suspended", "Account is suspended", 403);
    }
    if (e instanceof ProfileIncompleteError) {
      return errJson(
        "profile_incomplete",
        "Complete your profile before checkout",
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
    const result = await addItemForUser(ctx.user.id, body);
    if (result.kind === "duplicate") {
      return errJson(
        "duplicate_item",
        "That domain is already in your cart",
        409,
      );
    }
    return okJson({ item: result.item }, { status: 201 });
  } catch (e) {
    if (e instanceof CartStoreError) {
      return errJson(e.code, e.message, e.status);
    }
    console.error("[api/cart/items POST] unhandled error", e);
    return errJson("internal_error", "Internal server error", 500);
  }
}
