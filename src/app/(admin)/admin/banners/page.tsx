import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

import { BannerListClient } from "./BannerListClient";
import { resolveBannerImageUrl } from "@/lib/admin/banners";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * `/admin/banners` — admin banner CMS list view (PR-10).
 *
 * Lists every banner row (active + inactive) sorted by
 * `display_order`. Per-row actions (edit, delete, move up / down) and
 * the optimistic UI are delegated to the client component below; this
 * server component only handles the initial DB fetch and signed-URL
 * resolution.
 */
export default async function AdminBannersPage() {
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("banners")
    .select(
      "id, image_url, link_url, display_order, active, created_at, updated_at",
    )
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[admin/banners] select failed", error);
  }

  const rows = data ?? [];
  const resolved = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      preview_url: await resolveBannerImageUrl(supabase, row.image_url),
    })),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banners</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage the slides shown on the dashboard home page. Changes
            take effect on the next dashboard load.
          </p>
        </div>
        <Link
          href="/admin/banners/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
          Add banner
        </Link>
      </header>

      <BannerListClient initialBanners={resolved} />
    </div>
  );
}
