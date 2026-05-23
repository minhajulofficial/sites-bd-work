import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

/**
 * Public shape returned by `GET /api/banners` and consumed by the
 * `<BannerSlider>` client component. Mirrors the `banners` row but
 * deliberately omits admin-only columns (`created_by`, `active`,
 * timestamps) so the JSON payload stays minimal.
 */
export interface DashboardBanner {
  id: string;
  image_url: string;
  link_url: string | null;
  display_order: number;
}

type BannerRow = Database["public"]["Tables"]["banners"]["Row"];

/**
 * Loads the active banner slides in display order. Returns an empty
 * list (rather than throwing) on error so the dashboard can fall back
 * to the static welcome banner instead of failing the whole page.
 */
export async function getActiveBanners(
  supabase: SupabaseClient,
): Promise<DashboardBanner[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("id, image_url, link_url, display_order")
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[dashboard/banners] select failed", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const banner = row as Pick<
      BannerRow,
      "id" | "image_url" | "link_url" | "display_order"
    >;
    return {
      id: banner.id,
      image_url: banner.image_url,
      link_url: banner.link_url,
      display_order: banner.display_order,
    };
  });
}
