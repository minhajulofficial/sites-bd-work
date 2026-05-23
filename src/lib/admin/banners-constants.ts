/**
 * Constants shared between the server-only banner helpers and the
 * browser-side `BannerForm` component. Lives in its own module so the
 * client bundle doesn't try to pull in the `server-only` marker from
 * `./banners.ts`.
 */

/** Storage bucket id; mirrored in 0002_banners_storage.sql. */
export const BANNERS_BUCKET = "banners";

/** Hard cap on uploaded image size in bytes. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Allowed image MIME types. */
export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Hard caps on image pixel dimensions. */
export const MAX_IMAGE_WIDTH = 1920;
export const MAX_IMAGE_HEIGHT = 600;

/** TTL passed to `createSignedUrl()` for served banner URLs. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];
