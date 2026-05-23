import Link from "next/link";

import { BannerForm } from "../BannerForm";

export const dynamic = "force-dynamic";

export default function NewBannerPage() {
  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/banners"
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          ← Back to banners
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Add banner</h1>
      </header>
      <BannerForm />
    </div>
  );
}
