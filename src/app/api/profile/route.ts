import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson } from "@/lib/api/responses";
import {
  AccountSuspendedError,
  ProfileIncompleteError,
  UnauthorizedError,
  requireProfileVerified,
} from "@/lib/auth/session";
import { updateProfileBodySchema } from "@/lib/auth/validation";
import { createServiceSupabase } from "@/lib/supabase/server";
import authContent from "@/content/contentConstants.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/profile
 *
 * The only user-driven profile edit endpoint. Per PRD §3.1 only
 * `full_name` and `address` are editable. The DB trigger from PR-02
 * enforces the immutability of `email`, `mobile`, and `customer_id`
 * once `status = 'profile_verified'`, so even a hand-crafted request
 * that tries to PATCH those columns will be rejected at the database
 * layer. This handler additionally Zod-strips them at the API layer so
 * a benign typo never reaches the database.
 *
 * Guards:
 *   - `requireProfileVerified()` rejects anonymous, suspended, or
 *     half-onboarded callers.
 *   - `select` is scoped to the caller's `profiles.id`, so the
 *     service-role client (used to bypass RLS) can't be tricked into
 *     editing another user's row.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await requireProfileVerified();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return errJson(
        "unauthenticated",
        authContent.auth.errors.unauthenticated,
        401,
      );
    }
    if (e instanceof AccountSuspendedError) {
      return errJson(
        "account_suspended",
        authContent.auth.errors.accountSuspended,
        403,
      );
    }
    if (e instanceof ProfileIncompleteError) {
      return errJson(
        "profile_incomplete",
        authContent.auth.errors.profileIncomplete,
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
    body = updateProfileBodySchema.parse(raw);
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

  const update: { full_name?: string; address?: string } = {};
  if (body.full_name !== undefined) update.full_name = body.full_name;
  if (body.address !== undefined) update.address = body.address;

  const admin = createServiceSupabase();
  const { data, error } = await admin
    .from("profiles")
    .update(update)
    .eq("id", ctx.user.id)
    .select("full_name, address, email, mobile, customer_id, status")
    .single();

  if (error) {
    console.error("[api/profile] update failed", error);
    // The DB trigger raises an exception on email/mobile-change attempts
    // after `profile_verified`. Surface that as 400 immutable_field so
    // the client can render a meaningful inline error.
    const message = error.message?.toLowerCase() ?? "";
    if (
      message.includes("immutable") ||
      message.includes("cannot be changed") ||
      message.includes("violates")
    ) {
      return errJson(
        "immutable_field",
        authContent.auth.errors.immutableField,
        400,
      );
    }
    return errJson("internal_error", "Could not update profile", 500);
  }

  return NextResponse.json({ ok: true, profile: data });
}
