import Link from "next/link";
import { notFound } from "next/navigation";

import { BannerForm } from "../../BannerForm";
import { resolveBannerImageUrl } from "@/lib/admin/banners";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditBannerPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("banners")
    .select("id, image_url, link_url, display_order, active")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    console.error("[admin/banners edit] select failed", error);
  }
  if (!data) notFound();

  const previewUrl = await resolveBannerImageUrl(supabase, data.image_url);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/banners"
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          ← Back to banners
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Edit banner</h1>
      </header>
      <BannerForm
        initial={{
          id: data.id,
          preview_url: previewUrl,
          link_url: data.link_url,
          display_order: data.display_order,
          active: data.active,
        }}
      />
    </div>
  );
}
