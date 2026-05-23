"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown,
  faArrowUp,
  faExternalLinkAlt,
  faPenToSquare,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

export interface AdminBannerRow {
  id: string;
  image_url: string;
  preview_url: string;
  link_url: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Client wrapper for the admin banners list. Handles delete / move /
 * row actions via fetch and uses `router.refresh()` so the server
 * component re-fetches fresh data without a hard reload.
 */
export function BannerListClient({
  initialBanners,
}: {
  initialBanners: AdminBannerRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rows = initialBanners;

  async function handleMove(id: string, direction: "up" | "down") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/banners/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Failed to reorder banner");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reorder banner");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Delete this banner? The image file will also be removed and this cannot be undone.",
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Failed to delete banner");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete banner");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-700">No banners yet.</p>
        <p className="mt-1 text-sm text-gray-500">
          Click <span className="font-semibold">Add banner</span> to upload your
          first slide.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">
                Preview
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Link
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Order
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {rows.map((row, i) => (
              <tr key={row.id}>
                <td className="px-5 py-3">
                  <div className="relative aspect-[16/5] w-40 overflow-hidden rounded-md bg-gray-100">
                    <Image
                      src={row.preview_url}
                      alt=""
                      fill
                      sizes="160px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </td>
                <td className="px-5 py-3">
                  {row.link_url ? (
                    <a
                      href={row.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:text-primary-deep"
                    >
                      <span className="max-w-[200px] truncate">
                        {row.link_url}
                      </span>
                      <FontAwesomeIcon
                        icon={faExternalLinkAlt}
                        className="h-3 w-3"
                      />
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 tabular-nums text-gray-700">
                  {row.display_order}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                      (row.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-200 text-gray-700")
                    }
                  >
                    {row.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(row.id, "up")}
                      disabled={i === 0 || busyId === row.id}
                      aria-label="Move up"
                      className="rounded-md p-2 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <FontAwesomeIcon icon={faArrowUp} className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(row.id, "down")}
                      disabled={i === rows.length - 1 || busyId === row.id}
                      aria-label="Move down"
                      className="rounded-md p-2 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <FontAwesomeIcon
                        icon={faArrowDown}
                        className="h-3.5 w-3.5"
                      />
                    </button>
                    <Link
                      href={`/admin/banners/${row.id}/edit`}
                      aria-label="Edit"
                      className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
                    >
                      <FontAwesomeIcon
                        icon={faPenToSquare}
                        className="h-3.5 w-3.5"
                      />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      disabled={busyId === row.id}
                      aria-label="Delete"
                      className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
