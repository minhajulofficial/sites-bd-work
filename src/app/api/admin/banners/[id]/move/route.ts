import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";

import { errJson, okJson } from "@/lib/api/responses";
import {
  AccountSuspendedError,
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const moveBodySchema = z.object({
  direction: z.enum(["up", "down"]),
});

type RouteParams = { params: { id: string } };

/**
 * POST /api/admin/banners/:id/move
 *
 * Swaps the target banner's `display_order` with the immediate
 * neighbour in the requested direction.  "Up" means "lower
 * display_order"; "down" means "higher display_order". When the row
 * is already at the start or end of the list the request is a no-op
 * and returns the unchanged row.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch (e) {
    return handleAuthError(e);
  }

  let body;
  try {
    body = moveBodySchema.parse(await request.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return errJson(
        "invalid_body",
        e.issues[0]?.message ?? "Invalid request body",
        400,
      );
    }
    return errJson("invalid_body", "Body must be valid JSON", 400);
  }

  const supabase = createServerSupabase();

  const current = await supabase
    .from("banners")
    .select("id, display_order")
    .eq("id", params.id)
    .maybeSingle();
  if (current.error) {
    console.error("[api/admin/banners move] select failed", current.error);
    return errJson("select_failed", current.error.message, 500);
  }
  if (!current.data) {
    return errJson("not_found", "Banner not found", 404);
  }

  // Find the immediate neighbour:
  //   "up"   → highest display_order strictly less than current
  //   "down" → lowest  display_order strictly greater than current
  const neighbourQuery =
    body.direction === "up"
      ? supabase
          .from("banners")
          .select("id, display_order")
          .lt("display_order", current.data.display_order)
          .order("display_order", { ascending: false })
      : supabase
          .from("banners")
          .select("id, display_order")
          .gt("display_order", current.data.display_order)
          .order("display_order", { ascending: true });

  const neighbour = await neighbourQuery.limit(1).maybeSingle();
  if (neighbour.error) {
    console.error("[api/admin/banners move] neighbour failed", neighbour.error);
    return errJson("select_failed", neighbour.error.message, 500);
  }
  if (!neighbour.data) {
    // Already at the boundary — return the unchanged row.
    return okJson({ id: current.data.id, moved: false });
  }

  // Swap the two display_order values. Two UPDATEs rather than a
  // single CASE because supabase-js doesn't expose raw SQL without an
  // RPC; admin reorder is low-traffic so racing is not a real concern.
  const swap1 = await supabase
    .from("banners")
    .update({ display_order: neighbour.data.display_order })
    .eq("id", current.data.id);
  if (swap1.error) {
    console.error("[api/admin/banners move] swap1 failed", swap1.error);
    return errJson("update_failed", swap1.error.message, 500);
  }
  const swap2 = await supabase
    .from("banners")
    .update({ display_order: current.data.display_order })
    .eq("id", neighbour.data.id);
  if (swap2.error) {
    console.error("[api/admin/banners move] swap2 failed", swap2.error);
    // Best-effort revert so the table doesn't end up with two rows on
    // the same display_order.
    try {
      await supabase
        .from("banners")
        .update({ display_order: current.data.display_order })
        .eq("id", current.data.id);
    } catch {
      // Best-effort revert; ignore failures.
    }
    return errJson("update_failed", swap2.error.message, 500);
  }

  return okJson({ id: current.data.id, moved: true });
}

function handleAuthError(e: unknown): NextResponse {
  if (e instanceof UnauthorizedError) {
    return errJson("unauthenticated", "You must be signed in.", 401);
  }
  if (e instanceof ForbiddenError) {
    return errJson("forbidden", "Admin access required.", 403);
  }
  if (e instanceof AccountSuspendedError) {
    return errJson("suspended", "Account is suspended.", 403);
  }
  throw e;
}
