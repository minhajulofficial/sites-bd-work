import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { errJson, okJson } from "@/lib/api/responses";
import {
  AccountSuspendedError,
  ForbiddenError,
  UnauthorizedError,
  requireAdmin,
} from "@/lib/auth/session";
import {
  BANNERS_BUCKET,
  makeBannerStoragePath,
  parseBannerForm,
  validateBannerImage,
} from "@/lib/admin/banners";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/banners
 *
 * Admin-only. Accepts a `multipart/form-data` payload with:
 *   - `image`         (file, required)  jpg/png/webp, ≤ 2 MB
 *   - `link_url`      (string, optional)
 *   - `display_order` (number)
 *   - `active`        (boolean)
 *
 * Uploads the file to the `banners` storage bucket and inserts a row
 * into `public.banners`. The `image_url` column stores the storage
 * object path; the public `/api/banners` route signs it at fetch
 * time.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (e) {
    return handleAuthError(e);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return errJson("invalid_body", "Body must be multipart/form-data", 400);
  }

  let parsed;
  try {
    parsed = parseBannerForm(form);
  } catch (e) {
    if (e instanceof ZodError) {
      return errJson("invalid_body", e.issues[0]?.message ?? "Invalid form", 400);
    }
    throw e;
  }

  const imageCheck = validateBannerImage(parsed.image, { required: true });
  if (!imageCheck.ok) {
    return errJson(imageCheck.code, imageCheck.message, 400);
  }

  const supabase = createServerSupabase();
  const path = makeBannerStoragePath(imageCheck.file.name);
  const arrayBuffer = await imageCheck.file.arrayBuffer();

  const uploadRes = await supabase.storage
    .from(BANNERS_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: imageCheck.contentType,
      upsert: false,
    });
  if (uploadRes.error) {
    console.error("[api/admin/banners POST] upload failed", uploadRes.error);
    return errJson(
      "upload_failed",
      uploadRes.error.message ?? "Failed to upload image",
      500,
    );
  }

  const insertRes = await supabase
    .from("banners")
    .insert({
      image_url: path,
      link_url: parsed.link_url ?? null,
      display_order: parsed.display_order,
      active: parsed.active,
      created_by: ctx.user.id,
    })
    .select("id, image_url, link_url, display_order, active")
    .single();

  if (insertRes.error || !insertRes.data) {
    console.error("[api/admin/banners POST] insert failed", insertRes.error);
    // Best-effort cleanup so we don't orphan the storage object.
    await supabase.storage.from(BANNERS_BUCKET).remove([path]).catch(() => {});
    return errJson(
      "insert_failed",
      insertRes.error?.message ?? "Failed to save banner",
      500,
    );
  }

  return okJson(insertRes.data, { status: 201 });
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
