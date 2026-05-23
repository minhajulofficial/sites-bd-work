import "server-only";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

type DomainRow = Database["public"]["Tables"]["domains"]["Row"];
type OperationalStatus = DomainRow["operational_status"];
type VerificationStatus = DomainRow["verification_status"];

type RecentDomain = Pick<
  DomainRow,
  | "id"
  | "full_domain"
  | "operational_status"
  | "verification_status"
  | "registered_at"
>;

/**
 * Top-5 most recently registered domains for the signed-in user.
 * Rendered as a server component so the initial paint already has
 * the data — no client-side waterfall.
 *
 * When the list is empty an empty-state card is shown instead of an
 * empty table; this avoids the awkward "table header with no rows"
 * UX for brand-new users.
 */
export async function RecentDomainsTable({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("domains")
    .select(
      "id, full_domain, operational_status, verification_status, registered_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[dashboard/RecentDomainsTable] select failed", error);
  }

  const rows = ((data ?? []) as RecentDomain[]) ?? [];

  return (
    <section
      aria-label="Recent domains"
      className="rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Recent domains</h2>
        <Link
          href="/domains"
          className="text-sm font-medium text-primary hover:text-primary-deep"
        >
          View all →
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-500">
          You haven&apos;t claimed any domains yet.{" "}
          <Link href="/check" className="font-medium text-primary hover:text-primary-deep">
            Search for one →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Domain
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Verification
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Registered
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`/domains/${row.full_domain}`}
                      className="text-primary hover:text-primary-deep"
                    >
                      {row.full_domain}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <OperationalBadge value={row.operational_status} />
                  </td>
                  <td className="px-5 py-3">
                    <VerificationBadge value={row.verification_status} />
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {formatDate(row.registered_at)}
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

const OPERATIONAL_STYLES: Record<OperationalStatus, string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspend: "bg-red-100 text-red-700",
  issue: "bg-red-100 text-red-700",
  expired: "bg-gray-200 text-gray-700",
};

function OperationalBadge({ value }: { value: OperationalStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${OPERATIONAL_STYLES[value]}`}
    >
      {value}
    </span>
  );
}

const VERIFICATION_STYLES: Record<VerificationStatus, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  waiting: "bg-amber-100 text-amber-700",
};

function VerificationBadge({ value }: { value: VerificationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${VERIFICATION_STYLES[value]}`}
    >
      {value}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
