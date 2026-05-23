import "server-only";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

type RecentService = Pick<
  ServiceRow,
  | "id"
  | "type"
  | "plan_id"
  | "status_renewal"
  | "status_onetime"
  | "expires_at"
>;

const TYPE_LABELS: Record<ServiceRow["type"], string> = {
  hosting_premium: "Premium hosting",
  hosting_free: "Free hosting",
  hosting_custom: "Custom hosting",
  addon: "Add-on",
};

/**
 * Top-5 most recently created services for the signed-in user.
 * Shows type, plan, status (whichever of `status_renewal` /
 * `status_onetime` is populated), and expiry.
 */
export async function RecentServicesTable({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("services")
    .select("id, type, plan_id, status_renewal, status_onetime, expires_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[dashboard/RecentServicesTable] select failed", error);
  }

  const rows = ((data ?? []) as RecentService[]) ?? [];

  return (
    <section
      aria-label="Recent services"
      className="rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">
          Recent service orders
        </h2>
        <Link
          href="/services"
          className="text-sm font-medium text-primary hover:text-primary-deep"
        >
          View all →
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-500">
          No services yet.{" "}
          <Link
            href="/services"
            className="font-medium text-primary hover:text-primary-deep"
          >
            Browse hosting plans →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Type
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Plan
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-3 font-medium">
                    {TYPE_LABELS[row.type]}
                  </td>
                  <td className="px-5 py-3 text-gray-700">
                    {row.plan_id ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      renewal={row.status_renewal}
                      onetime={row.status_onetime}
                    />
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {row.expires_at ? formatDate(row.expires_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatusBadge({
  renewal,
  onetime,
}: {
  renewal: ServiceRow["status_renewal"];
  onetime: ServiceRow["status_onetime"];
}) {
  const status = renewal ?? onetime ?? "—";
  const tone = renewal
    ? RENEWAL_STYLES[renewal]
    : onetime
      ? ONETIME_STYLES[onetime]
      : "bg-gray-200 text-gray-700";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {status}
    </span>
  );
}

const RENEWAL_STYLES: Record<
  NonNullable<ServiceRow["status_renewal"]>,
  string
> = {
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  expired: "bg-gray-200 text-gray-700",
  suspended: "bg-red-100 text-red-700",
};

const ONETIME_STYLES: Record<
  NonNullable<ServiceRow["status_onetime"]>,
  string
> = {
  waiting: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  complete: "bg-emerald-100 text-emerald-700",
  cancel: "bg-gray-200 text-gray-700",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
