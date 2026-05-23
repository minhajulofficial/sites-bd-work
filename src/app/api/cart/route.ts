import { NextResponse, type NextRequest } from "next/server";

import { errJson, okJson } from "@/lib/api/responses";
import { CartStoreError, listCartForUser } from "@/lib/cart/store";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  getCurrentUser,
} from "@/lib/auth/session";
import type { CartFetchResponse } from "@/lib/cart/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cart
 *
 * Returns the caller's cart contents. For authenticated requests we
 * load `cart_items` rows; for guests we return `mode: "guest"` and an
 * empty `items` array — the client is expected to overlay its own
 * `sessionStorage.guestCart` from there.
 *
 * Errors are returned as the standard `{ error: { code, message } }`
 * envelope. A 401 on this endpoint just means "you're a guest"; the
 * client distinguishes that case from the 200 `mode: "guest"` branch
 * via the explicit mode flag and is not expected to translate the 401
 * into an auth-bounce.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await getCurrentUser();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return okJson<CartFetchResponse>({ mode: "guest", items: [] });
    }
    if (e instanceof AccountSuspendedError) {
      return errJson("account_suspended", "Account is suspended", 403);
    }
    if (e instanceof ProfileIncompleteError) {
      // Treat half-onboarded users as guests for the purpose of the
      // cart read — they haven't finished verifying yet so we don't
      // want to surface a stale DB cart to them.
      return okJson<CartFetchResponse>({ mode: "guest", items: [] });
    }
    throw e;
  }

  if (!ctx) {
    return okJson<CartFetchResponse>({ mode: "guest", items: [] });
  }

  try {
    const items = await listCartForUser(ctx.user.id);
    return okJson<CartFetchResponse>({ mode: "user", items });
  } catch (e) {
    if (e instanceof CartStoreError) {
      return errJson(e.code, e.message, e.status);
    }
    console.error("[api/cart GET] unhandled error", e);
    return errJson("internal_error", "Internal server error", 500);
  }
}
