"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  ALLOWED_IMAGE_MIMES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
} from "@/lib/admin/banners-constants";

export interface BannerFormInitialValues {
  id: string;
  preview_url: string;
  link_url: string | null;
  display_order: number;
  active: boolean;
}

interface Props {
  /** Pre-populated values when editing; null when creating. */
  initial?: BannerFormInitialValues | null;
}

/**
 * Shared client form for the create and edit flows. Wraps a native
 * `<form>` (multipart) and runs client-side image validation
 * (size + MIME + pixel dimensions) before submitting to either
 * `POST /api/admin/banners` (create) or
 * `PATCH /api/admin/banners/:id` (update).
 */
export function BannerForm({ initial = null }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [linkUrl, setLinkUrl] = useState(initial?.link_url ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    initial?.display_order ?? 0,
  );
  const [active, setActive] = useState(initial?.active ?? true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial?.preview_url ?? null,
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  // Revoke the object URL created for the preview when it's replaced
  // or when the form unmounts. Only revoke URLs we created (i.e. the
  // `blob:` ones) — leave the initial signed URL alone.
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setImageError(null);
    if (!file) {
      setPreviewUrl(initial?.preview_url ?? null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(
        `Image must be ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB or smaller.`,
      );
      e.target.value = "";
      return;
    }
    if (!(ALLOWED_IMAGE_MIMES as ReadonlyArray<string>).includes(file.type)) {
      setImageError("Image must be a JPG, PNG, or WEBP file.");
      e.target.value = "";
      return;
    }
    const dim = await readImageDimensions(file);
    if (!dim) {
      setImageError("That file doesn't look like a valid image.");
      e.target.value = "";
      return;
    }
    if (dim.width > MAX_IMAGE_WIDTH) {
      setImageError(
        `Image is ${dim.width}px wide; the maximum is ${MAX_IMAGE_WIDTH}px.`,
      );
      e.target.value = "";
      return;
    }
    if (dim.height > MAX_IMAGE_HEIGHT) {
      setImageError(
        `Image is ${dim.height}px tall; the maximum is ${MAX_IMAGE_HEIGHT}px.`,
      );
      e.target.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (imageError) return;
    setSubmitError(null);
    setSubmitting(true);

    const form = new FormData();
    const file = fileRef.current?.files?.[0];
    if (file) form.append("image", file);
    form.append("link_url", linkUrl.trim());
    form.append("display_order", String(displayOrder));
    form.append("active", active ? "true" : "false");

    if (!initial && !file) {
      setImageError("Please choose an image to upload.");
      setSubmitting(false);
      return;
    }

    const url = initial
      ? `/api/admin/banners/${initial.id}`
      : "/api/admin/banners";
    const method = initial ? "PATCH" : "POST";

    try {
      const res = await fetch(url, { method, body: form });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Failed to save banner");
      }
      startTransition(() => {
        router.push("/admin/banners");
        router.refresh();
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save banner");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Image
        </label>
        <p className="mt-1 text-xs text-gray-500">
          JPG, PNG, or WEBP. Up to {MAX_IMAGE_WIDTH}×{MAX_IMAGE_HEIGHT}px,
          {" "}
          {(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB.
        </p>
        <input
          ref={fileRef}
          type="file"
          name="image"
          accept={ALLOWED_IMAGE_MIMES.join(",")}
          onChange={handleFileChange}
          className="mt-2 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-deep"
          required={!initial}
        />
        {imageError ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {imageError}
          </p>
        ) : null}
        {previewUrl ? (
          <div className="relative mt-3 aspect-[16/5] w-full max-w-xl overflow-hidden rounded-md border border-gray-200 bg-gray-50">
            <Image
              src={previewUrl}
              alt=""
              fill
              sizes="(min-width: 640px) 480px, 100vw"
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="link_url"
          className="block text-sm font-medium text-gray-900"
        >
          Link URL <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="link_url"
          name="link_url"
          type="url"
          inputMode="url"
          placeholder="https://example.com/landing-page"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="display_order"
            className="block text-sm font-medium text-gray-900"
          >
            Display order
          </label>
          <input
            id="display_order"
            name="display_order"
            type="number"
            min={0}
            value={displayOrder}
            onChange={(e) =>
              setDisplayOrder(Math.max(0, Number(e.target.value) || 0))
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="mt-1 text-xs text-gray-500">
            Lower numbers appear first. Use the Move buttons on the list
            page for quick reordering.
          </p>
        </div>

        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Active (shown on dashboard)
          </label>
        </div>
      </div>

      {submitError ? (
        <p role="alert" className="text-sm text-red-700">
          {submitError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/admin/banners"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting || Boolean(imageError)}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : initial ? "Save changes" : "Create banner"}
        </button>
      </div>
    </form>
  );
}

async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
