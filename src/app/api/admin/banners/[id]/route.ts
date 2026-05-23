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
  isExternalUrl,
  makeBannerStoragePath,
  parseBannerForm,
  validateBannerImage,
} from "@/lib/admin/banners";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

/**
 * PATCH /api/admin/banners/:id
 *
 * Admin-only. Accepts the same `multipart/form-data` shape as the
 * create endpoint; `image` is optional — when omitted the existing
 * stored object is kept. When a new image is uploaded the previous
 * object is removed from storage to avoid orphaning blobs.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    await requireAdmin();
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

  const imageCheck = validateBannerImage(parsed.image, { required: false });
  if (!imageCheck.ok) {
    return errJson(imageCheck.code, imageCheck.message, 400);
  }

  const supabase = createServerSupabase();

  const existing = await supabase
    .from("banners")
    .select("id, image_url")
    .eq("id", params.id)
    .maybeSingle();
  if (existing.error) {
    console.error("[api/admin/banners PATCH] select failed", existing.error);
    return errJson("select_failed", existing.error.message, 500);
  }
  if (!existing.data) {
    return errJson("not_found", "Banner not found", 404);
  }

  let newPath: string | null = null;
  if (parsed.image) {
    newPath = makeBannerStoragePath(parsed.image.name);
    const arrayBuffer = await parsed.image.arrayBuffer();
    const uploadRes = await supabase.storage
      .from(BANNERS_BUCKET)
      .upload(newPath, arrayBuffer, {
        contentType: imageCheck.contentType,
        upsert: false,
      });
    if (uploadRes.error) {
      console.error("[api/admin/banners PATCH] upload failed", uploadRes.error);
      return errJson(
        "upload_failed",
        uploadRes.error.message ?? "Failed to upload image",
        500,
      );
    }
  }

  const updatePayload = {
    link_url: parsed.link_url ?? null,
    display_order: parsed.display_order,
    active: parsed.active,
    ...(newPath ? { image_url: newPath } : {}),
  };

  const updateRes = await supabase
    .from("banners")
    .update(updatePayload)
    .eq("id", params.id)
    .select("id, image_url, link_url, display_order, active")
    .single();

  if (updateRes.error || !updateRes.data) {
    console.error("[api/admin/banners PATCH] update failed", updateRes.error);
    if (newPath) {
      await supabase.storage
        .from(BANNERS_BUCKET)
        .remove([newPath])
        .catch(() => {});
    }
    return errJson(
      "update_failed",
      updateRes.error?.message ?? "Failed to update banner",
      500,
    );
  }

  if (newPath && existing.data.image_url && !isExternalUrl(existing.data.image_url)) {
    await supabase.storage
      .from(BANNERS_BUCKET)
      .remove([existing.data.image_url])
      .catch((err: unknown) => {
        console.error("[api/admin/banners PATCH] cleanup failed", err);
      });
  }

  return okJson(updateRes.data);
}

/**
 * DELETE /api/admin/banners/:id
 *
 * Admin-only. Removes the row and its backing storage object (if the
 * `image_url` is a storage path rather than an external URL).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch (e) {
    return handleAuthError(e);
  }

  const supabase = createServerSupabase();

  const existing = await supabase
    .from("banners")
    .select("id, image_url")
    .eq("id", params.id)
    .maybeSingle();
  if (existing.error) {
    console.error("[api/admin/banners DELETE] select failed", existing.error);
    return errJson("select_failed", existing.error.message, 500);
  }
  if (!existing.data) {
    return errJson("not_found", "Banner not found", 404);
  }

  const deleteRes = await supabase
    .from("banners")
    .delete()
    .eq("id", params.id);
  if (deleteRes.error) {
    console.error("[api/admin/banners DELETE] delete failed", deleteRes.error);
    return errJson("delete_failed", deleteRes.error.message, 500);
  }

  if (existing.data.image_url && !isExternalUrl(existing.data.image_url)) {
    await supabase.storage
      .from(BANNERS_BUCKET)
      .remove([existing.data.image_url])
      .catch((err: unknown) => {
        console.error("[api/admin/banners DELETE] storage cleanup failed", err);
      });
  }

  return okJson({ id: params.id });
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
