import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ALLOWED_IMAGE_MIMES,
  BANNERS_BUCKET,
  MAX_IMAGE_BYTES,
  SIGNED_URL_TTL_SECONDS,
  type AllowedImageMime,
} from "./banners-constants";

export {
  ALLOWED_IMAGE_MIMES,
  BANNERS_BUCKET,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  SIGNED_URL_TTL_SECONDS,
} from "./banners-constants";
export type { AllowedImageMime } from "./banners-constants";

const ALLOWED_MIMES = new Set<string>(ALLOWED_IMAGE_MIMES);

/**
 * Form-payload schema shared between the create + update endpoints.
 * All fields are optional at the schema level so PATCH can be sent
 * with just the changed columns; per-route code re-asserts that
 * `image` is present on the create path.
 */
export const bannerFormSchema = z.object({
  link_url: z
    .string()
    .trim()
    .max(2048, "Link is too long")
    .url("Link must be a valid URL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  display_order: z
    .number()
    .int("display_order must be an integer")
    .min(0, "display_order cannot be negative")
    .max(1_000_000, "display_order is too large"),
  active: z.boolean(),
});

export type BannerFormValues = z.infer<typeof bannerFormSchema>;

export interface ParsedBannerForm extends BannerFormValues {
  image: File | null;
}

/**
 * Pulls the well-known fields out of a `FormData` body and runs them
 * through Zod. Multipart submissions stringify everything, so
 * `display_order` and `active` are coerced back to their typed
 * representation here.
 */
export function parseBannerForm(form: FormData): ParsedBannerForm {
  const rawImage = form.get("image");
  const image = rawImage instanceof File && rawImage.size > 0 ? rawImage : null;

  const linkRaw = form.get("link_url");
  const orderRaw = form.get("display_order");
  const activeRaw = form.get("active");

  const parsed = bannerFormSchema.parse({
    link_url: typeof linkRaw === "string" ? linkRaw : undefined,
    display_order: orderRaw === null ? 0 : Number(orderRaw),
    active:
      activeRaw === "true" || activeRaw === "on" || activeRaw === "1",
  });

  return { ...parsed, image };
}

export interface ImageValidationFailure {
  ok: false;
  code:
    | "image_required"
    | "image_too_large"
    | "image_bad_type"
    | "image_too_wide"
    | "image_too_tall";
  message: string;
}

export interface ImageValidationSuccess {
  ok: true;
  file: File;
  contentType: AllowedImageMime;
}

export type ImageValidationResult =
  | ImageValidationFailure
  | ImageValidationSuccess;

/**
 * Server-side image gate. Caps file size and MIME type; dimension
 * validation happens client-side in `BannerForm` because parsing
 * pixel dimensions on the server would require an image-decoder
 * dependency and the admin route is trusted-only.
 *
 * When `required = false`, a missing file passes validation — useful
 * for PATCH where the admin may keep the existing image.
 */
export function validateBannerImage(
  file: File | null,
  options: { required: boolean },
): ImageValidationResult {
  if (!file) {
    if (options.required) {
      return {
        ok: false,
        code: "image_required",
        message: "An image file is required.",
      };
    }
    // Caller treats "no file" as "leave the existing image alone".
    return {
      ok: true,
      file: new File([], "noop"),
      contentType: "image/png",
    };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      code: "image_too_large",
      message: `Image must be ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB or smaller.`,
    };
  }

  if (!ALLOWED_MIMES.has(file.type)) {
    return {
      ok: false,
      code: "image_bad_type",
      message: "Image must be a JPG, PNG, or WEBP file.",
    };
  }

  return {
    ok: true,
    file,
    contentType: file.type as AllowedImageMime,
  };
}

/**
 * Generates the storage path used for a new upload. Uses a millisecond
 * timestamp prefix so the lexical order roughly matches creation
 * order, plus a short random suffix to avoid collisions when two
 * admins upload in the same millisecond.
 */
export function makeBannerStoragePath(originalName: string): string {
  const sanitized = originalName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const stem = sanitized || "banner";
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}-${stem}`;
}

/**
 * Returns `true` when `value` already looks like a fully-qualified
 * HTTP(S) URL. Used by `/api/banners` to decide whether to sign a
 * storage path or pass an external URL straight through.
 */
export function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Best-effort signed-URL resolver. Falls back to the raw value when
 * signing fails so the dashboard doesn't render a broken slide for a
 * single bad row.
 */
export async function resolveBannerImageUrl(
  supabase: SupabaseClient,
  imageUrl: string,
): Promise<string> {
  if (isExternalUrl(imageUrl)) return imageUrl;
  const { data, error } = await supabase.storage
    .from(BANNERS_BUCKET)
    .createSignedUrl(imageUrl, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("[admin/banners] createSignedUrl failed", error);
    return imageUrl;
  }
  return data.signedUrl;
}
