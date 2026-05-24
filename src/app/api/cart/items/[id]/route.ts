import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { errJson, okJson } from "@/lib/api/responses";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  requireProfileVerified,
} from "@/lib/auth/session";
import { isValidPremiumPlanId, isValidFreeOptionId } from "@/lib/hosting/plans";
import {
  CartStoreError,
  removeItemForUser,
  updateItemForUser,
} from "@/lib/cart/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid("Invalid item id");

const patchSchema = z
  .object({
    hostingType: z
      .enum(["premium", "free", "custom_ns", "custom_ip"])
      .nullable()
      .optional(),
    hostingPlanId: z.string().min(1).max(64).nullable().optional(),
    customNsValues: z.array(z.string().max(255)).max(8).nullable().optional(),
    customIpValue: z.string().max(45).nullable().optional(),
    addons: z.array(z.record(z.unknown())).max(32).optional(),
  })
  .refine(
    (v) =>
      v.hostingType !== undefined ||
      v.hostingPlanId !== undefined ||
      v.customNsValues !== undefined ||
      v.customIpValue !== undefined ||
      v.addons !== undefined,
    "At least one field must be supplied",
  );

/**
 * Validate that hostingPlanId exists in config when hostingType is
 * "premium" or "free". PRD §3.3 server-side rule.
 */
function validateHostingPlan(
  hostingType: string | null | undefined,
  hostingPlanId: string | null | undefined,
): string | null {
  if (!hostingPlanId) return null;
  if (hostingType === "premium" && !isValidPremiumPlanId(hostingPlanId)) {
    return `Unknown premium hosting plan: ${hostingPlanId}`;
  }
  if (hostingType === "free" && !isValidFreeOptionId(hostingPlanId)) {
    return `Unknown free hosting option: ${hostingPlanId}`;
  }
  return null;
}

async function authOrReject(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  try {
    const ctx = await requireProfileVerified();
    return { ok: true, userId: ctx.user.id };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        ok: false,
        response: errJson(
          "unauthenticated",
          "Sign in to manage your cart",
          401,
        ),
      };
    }
    if (e instanceof AccountSuspendedError) {
      return {
        ok: false,
        response: errJson("account_suspended", "Account is suspended", 403),
      };
    }
    if (e instanceof ProfileIncompleteError) {
      return {
        ok: false,
        response: errJson(
          "profile_incomplete",
          "Complete your profile before checkout",
          403,
        ),
      };
    }
    throw e;
  }
}

function parseId(id: string): NextResponse | string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return errJson(
      "invalid_id",
      parsed.error.issues[0]?.message ?? "Invalid item id",
      400,
    );
  }
  return parsed.data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const idOrErr = parseId(params.id);
  if (typeof idOrErr !== "string") return idOrErr;

  const auth = await authOrReject();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errJson("invalid_body", "Body must be valid JSON", 400);
  }

  let patch;
  try {
    patch = patchSchema.parse(raw);
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

  // Validate hosting plan against config (PRD §3.3)
  const hostingValidationError = validateHostingPlan(
    patch.hostingType,
    patch.hostingPlanId,
  );
  if (hostingValidationError) {
    return errJson("invalid_hosting_plan", hostingValidationError, 400);
  }

  try {
    const item = await updateItemForUser(auth.userId, idOrErr, patch);
    if (!item) return errJson("not_found", "Cart item not found", 404);
    return okJson({ item });
  } catch (e) {
    if (e instanceof CartStoreError) {
      return errJson(e.code, e.message, e.status);
    }
    console.error("[api/cart/items PATCH] unhandled error", e);
    return errJson("internal_error", "Internal server error", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const idOrErr = parseId(params.id);
  if (typeof idOrErr !== "string") return idOrErr;

  const auth = await authOrReject();
  if (!auth.ok) return auth.response;

  try {
    const removed = await removeItemForUser(auth.userId, idOrErr);
    if (!removed) return errJson("not_found", "Cart item not found", 404);
    return okJson({ removed: true });
  } catch (e) {
    if (e instanceof CartStoreError) {
      return errJson(e.code, e.message, e.status);
    }
    console.error("[api/cart/items DELETE] unhandled error", e);
    return errJson("internal_error", "Internal server error", 500);
  }
}
