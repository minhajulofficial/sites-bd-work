"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSpinner,
  faCircleCheck,
  faCircleXmark,
  faTriangleExclamation,
  faRotateRight,
  faCartPlus,
  faIdCard,
} from "@fortawesome/free-solid-svg-icons";

import type { TldEntry } from "@/lib/domains/registry";
import { searchDomains } from "@/lib/domain/client";
import {
  normaliseNames,
  parseQueryString,
  type SearchResult,
} from "@/lib/domain/shared";

const WhoisModal = dynamic(
  () => import("@/components/domain/WhoisModal").then((m) => m.WhoisModal),
  { ssr: false },
);

type DomainCheckProps = {
  tlds: TldEntry[];
};

/**
 * Homepage "Check Your Domain Name" section.
 *
 * Visual layout is unchanged from PR-01's port: input on the left, the
 * TLD-suffix UI element on the right, full-width "Check Availability"
 * button below. The submit handler now runs the search inline against
 * `/api/domain/check` and lazy-loads the results renderer below the
 * button. The TLD dropdown still controls "preferred TLD" (it's shown
 * first in the results), but results include every enabled TLD so the
 * visitor immediately sees the cheaper / available alternatives.
 *
 * A "See full search" link routes the visitor to `/check?q=…` for the
 * fully featured multi-name + multi-TLD experience.
 */
export function DomainCheck({ tlds }: DomainCheckProps) {
  const router = useRouter();
  const defaultTld = useMemo(
    () => tlds.find((t) => t.isPrimary) ?? tlds[0],
    [tlds],
  );
  const [name, setName] = useState("");
  const [tldId, setTldId] = useState<string>(defaultTld?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [whoisTarget, setWhoisTarget] = useState<SearchResult | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(() => new Set());

  const abortRef = useRef<AbortController | null>(null);
  const lastNamesRef = useRef<string[]>([]);

  const tldOrder = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>();
    // Selected TLD first, then the rest in registry order, so the
    // primary "preferred" row is visually emphasized.
    const ordered = [
      ...tlds.filter((t) => t.id === tldId),
      ...tlds.filter((t) => t.id !== tldId),
    ];
    ordered.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [tlds, tldId]);

  const sortedResults = useMemo(
    () =>
      [...results].sort((a, b) => {
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        const ai = tldOrder.get(a.tldId) ?? 999;
        const bi = tldOrder.get(b.tldId) ?? 999;
        return ai - bi;
      }),
    [results, tldOrder],
  );

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const tokens = parseQueryString(name);
      const norm = normaliseNames(tokens);
      if (!norm.ok) {
        setError(norm.error);
        setResults([]);
        setSearched(true);
        return;
      }
      setError(null);
      setLoading(true);
      setSearched(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await searchDomains({
        names: norm.names,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      setLoading(false);
      if (!res.ok) {
        if (res.error.code !== "aborted") setError(res.error.message);
        setResults([]);
        return;
      }
      lastNamesRef.current = norm.names;
      setResults(res.results);
    },
    [name],
  );

  const handleRetry = useCallback(async (rowTldId: string) => {
    if (lastNamesRef.current.length === 0) return;
    setRetrying((prev) => {
      const next = new Set(prev);
      next.add(rowTldId);
      return next;
    });
    const res = await searchDomains({
      names: lastNamesRef.current,
      tldIds: [rowTldId],
    });
    setRetrying((prev) => {
      const next = new Set(prev);
      next.delete(rowTldId);
      return next;
    });
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setResults((prev) => {
      const byKey = new Map<string, SearchResult>();
      for (const row of prev) byKey.set(`${row.name}:${row.tldId}`, row);
      for (const row of res.results) byKey.set(`${row.name}:${row.tldId}`, row);
      return prev.map((row) => byKey.get(`${row.name}:${row.tldId}`) ?? row);
    });
  }, []);

  const handleClaim = useCallback(
    (row: SearchResult) => {
      window.dispatchEvent(
        new CustomEvent("domain-claim", {
          detail: {
            name: row.name,
            tldId: row.tldId,
            fullDomain: row.fullDomain,
          },
        }),
      );
      console.info("[domain-claim]", row.fullDomain);
    },
    [],
  );

  const goToCheckPage = useCallback(() => {
    const trimmed = name.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    router.push(params.toString() ? `/check?${params.toString()}` : "/check");
  }, [name, router]);

  return (
    <section id="order" className="py-24 bg-blue-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-6" data-aos="fade-up">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            Check Your Domain Name
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Instantly check if your desired subdomain is available
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div data-aos="fade-up" data-aos-delay="100">
            <form className="space-y-6" onSubmit={onSubmit}>
              <div>
                <div className="flex items-center bg-gray-50 rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500">
                  <input
                    type="text"
                    id="subdomainName"
                    name="subdomain"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter Your Domain Name"
                    className="w-4/6 text-lg font-medium bg-transparent border-none px-4 py-3 focus:outline-none"
                  />
                  <label htmlFor="tldSelect" className="sr-only">
                    Parent domain
                  </label>
                  <select
                    id="tldSelect"
                    name="tld"
                    value={tldId}
                    onChange={(e) => setTldId(e.target.value)}
                    className="w-2/6 text-center text-lg font-semibold text-gray-600 bg-transparent border-l border-gray-300 px-3 py-3 focus:outline-none cursor-pointer"
                  >
                    {tlds.map((tld) => (
                      <option key={tld.id} value={tld.id}>
                        .{tld.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-center text-sm font-semibold">
                Example: bdshop / arman-mia
              </div>

              <button
                type="submit"
                id="checkBtn"
                disabled={loading}
                className="w-full primary-gradient text-white py-4 rounded-lg font-bold text-lg hover-lift disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <FontAwesomeIcon
                  icon={loading ? faSpinner : faSearch}
                  className={`mr-2 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Checking…" : "Check Availability"}
              </button>
            </form>

            <div id="result" className="mt-6 space-y-3">
              {error && (
                <div
                  role="alert"
                  className="bg-yellow-100 text-yellow-700 border border-yellow-200 p-3 rounded-lg text-sm"
                >
                  {error}
                </div>
              )}

              {searched && !error && !loading && sortedResults.length === 0 && (
                <div className="bg-white border border-gray-200 text-gray-600 p-3 rounded-lg text-sm text-center">
                  No results to show.
                </div>
              )}

              {sortedResults.length > 0 && (
                <>
                  <ul className="space-y-2">
                    {sortedResults.map((row) => (
                      <InlineRow
                        key={`${row.name}:${row.tldId}`}
                        row={row}
                        retrying={retrying.has(row.tldId)}
                        onClaim={handleClaim}
                        onWhois={(r) => setWhoisTarget(r)}
                        onRetry={handleRetry}
                      />
                    ))}
                  </ul>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={goToCheckPage}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      See full search →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <WhoisModal
        open={whoisTarget !== null}
        result={whoisTarget}
        onClose={() => setWhoisTarget(null)}
      />
    </section>
  );
}

/**
 * A trimmed-down result row used inline on the homepage. Mirrors the
 * design of `SearchResults` but keeps the markup self-contained so we
 * don't pull the full grouping renderer into the marketing bundle.
 */
function InlineRow({
  row,
  retrying,
  onClaim,
  onWhois,
  onRetry,
}: {
  row: SearchResult;
  retrying: boolean;
  onClaim: (r: SearchResult) => void;
  onWhois: (r: SearchResult) => void;
  onRetry: (tldId: string) => void;
}) {
  const kind: "available" | "taken" | "unknown" =
    row.status === "unknown" ? "unknown" : row.available ? "available" : "taken";

  const wrapClass =
    kind === "available"
      ? "border-green-200 bg-green-50"
      : kind === "unknown"
        ? "border-yellow-200 bg-yellow-50"
        : "border-gray-200 bg-gray-100 opacity-90";

  const iconClass =
    kind === "available"
      ? "text-green-600"
      : kind === "unknown"
        ? "text-yellow-600"
        : "text-gray-500";

  const icon =
    kind === "available"
      ? faCircleCheck
      : kind === "unknown"
        ? faTriangleExclamation
        : faCircleXmark;

  const badge =
    kind === "available"
      ? "bg-green-100 text-green-800"
      : kind === "unknown"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-gray-200 text-gray-700";

  const badgeText =
    kind === "available" ? "AVAILABLE" : kind === "unknown" ? "UNKNOWN" : "TAKEN";

  return (
    <li
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border px-4 py-3 ${wrapClass}`}
    >
      <div className="flex items-center min-w-0 text-left">
        <FontAwesomeIcon
          icon={icon}
          className={`mr-3 text-lg ${iconClass}`}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="font-mono text-base font-semibold text-gray-900 break-all">
            {row.fullDomain}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold tracking-wide ${badge}`}
            >
              {badgeText}
            </span>
            <span className="text-gray-500">on .{row.tldName}</span>
            {kind === "unknown" && row.error && (
              <span className="text-yellow-700">{row.error}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 sm:ml-4">
        {kind === "available" && (
          <button
            type="button"
            onClick={() => onClaim(row)}
            className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <FontAwesomeIcon icon={faCartPlus} className="mr-2" />
            Claim
          </button>
        )}
        {kind === "taken" && (
          <button
            type="button"
            onClick={() => onWhois(row)}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <FontAwesomeIcon icon={faIdCard} className="mr-2" />
            Whois
          </button>
        )}
        {kind === "unknown" && (
          <button
            type="button"
            onClick={() => onRetry(row.tldId)}
            disabled={retrying}
            className="inline-flex items-center rounded-md border border-yellow-300 bg-white px-3 py-2 text-sm font-semibold text-yellow-800 shadow-sm hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FontAwesomeIcon
              icon={retrying ? faSpinner : faRotateRight}
              className={`mr-2 ${retrying ? "animate-spin" : ""}`}
            />
            {retrying ? "Retrying…" : "Try again"}
          </button>
        )}
      </div>
    </li>
  );
}
