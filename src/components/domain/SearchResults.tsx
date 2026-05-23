"use client";

import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleXmark,
  faTriangleExclamation,
  faSpinner,
  faCartPlus,
  faIdCard,
  faRotateRight,
  faGlobe,
} from "@fortawesome/free-solid-svg-icons";

import type { SearchResult } from "@/lib/domain/shared";
import type { TldEntry } from "@/lib/domains/registry";

type SearchResultsProps = {
  results: SearchResult[];
  /** Optional registry — used to keep TLDs in a stable order across renders. */
  tlds?: TldEntry[];
  loading?: boolean;
  /** `true` once a search has been issued; suppresses the empty state. */
  searched?: boolean;
  /** Set of `tldId`s currently being refetched (drives the per-row spinner). */
  retryingTldIds?: ReadonlySet<string>;
  onWhois: (result: SearchResult) => void;
  onClaim: (result: SearchResult) => void;
  onRetry: (tldId: string) => void;
  emptyMessage?: string;
};

type ResultGroup = {
  name: string;
  rows: SearchResult[];
};

/**
 * Renders search results grouped by name, sub-grouped by TLD. Each
 * row is either:
 *
 *   - green / available    — full domain + "Claim / Add to Cart"
 *   - grey / taken         — full domain + "Whois"
 *   - yellow / unknown     — TLD timed out, "Try again" refetches just that TLD
 */
export function SearchResults({
  results,
  tlds,
  loading = false,
  searched = false,
  retryingTldIds,
  onWhois,
  onClaim,
  onRetry,
  emptyMessage = "Enter a name above to check availability.",
}: SearchResultsProps) {
  const tldOrder = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>();
    (tlds ?? []).forEach((t, i) => m.set(t.id, i));
    return m;
  }, [tlds]);

  const groups = useMemo<ResultGroup[]>(() => {
    const byName = new Map<string, SearchResult[]>();
    const insertionOrder: string[] = [];
    for (const row of results) {
      if (!byName.has(row.name)) {
        byName.set(row.name, []);
        insertionOrder.push(row.name);
      }
      byName.get(row.name)!.push(row);
    }
    return insertionOrder.map((name) => ({
      name,
      rows: [...(byName.get(name) ?? [])].sort((a, b) => {
        const ai = tldOrder.get(a.tldId) ?? 999;
        const bi = tldOrder.get(b.tldId) ?? 999;
        if (ai !== bi) return ai - bi;
        return a.tldId.localeCompare(b.tldId);
      }),
    }));
  }, [results, tldOrder]);

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <FontAwesomeIcon icon={faSpinner} className="mr-3 animate-spin" />
        Checking availability across every enabled TLD…
      </div>
    );
  }

  if (groups.length === 0) {
    if (!searched) {
      return (
        <div className="text-center text-sm text-gray-500 py-8">
          {emptyMessage}
        </div>
      );
    }
    return (
      <div className="text-center text-sm text-gray-600 py-8">
        No results to show.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.name} aria-labelledby={`group-${group.name}`}>
          <h3
            id={`group-${group.name}`}
            className="flex items-center text-lg font-semibold text-gray-800 mb-3"
          >
            <FontAwesomeIcon
              icon={faGlobe}
              className="mr-2 text-primary"
              aria-hidden
            />
            <span className="font-mono">{group.name}</span>
          </h3>
          <ul className="space-y-2">
            {group.rows.map((row) => (
              <ResultRow
                key={`${row.name}:${row.tldId}`}
                row={row}
                retrying={retryingTldIds?.has(row.tldId) ?? false}
                onWhois={onWhois}
                onClaim={onClaim}
                onRetry={onRetry}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

type RowKind = "available" | "taken" | "unknown";

function rowKind(row: SearchResult): RowKind {
  if (row.status === "unknown") return "unknown";
  if (row.available) return "available";
  return "taken";
}

const KIND_STYLES: Record<RowKind, { wrap: string; icon: typeof faCircleCheck; iconClass: string; badge: string; badgeText: string }> = {
  available: {
    wrap: "border-green-200 bg-green-50",
    icon: faCircleCheck,
    iconClass: "text-green-600",
    badge: "bg-green-100 text-green-800",
    badgeText: "AVAILABLE",
  },
  taken: {
    wrap: "border-gray-200 bg-gray-100",
    icon: faCircleXmark,
    iconClass: "text-gray-500",
    badge: "bg-gray-200 text-gray-700",
    badgeText: "TAKEN",
  },
  unknown: {
    wrap: "border-yellow-200 bg-yellow-50",
    icon: faTriangleExclamation,
    iconClass: "text-yellow-600",
    badge: "bg-yellow-100 text-yellow-800",
    badgeText: "UNKNOWN",
  },
};

function ResultRow({
  row,
  retrying,
  onWhois,
  onClaim,
  onRetry,
}: {
  row: SearchResult;
  retrying: boolean;
  onWhois: (result: SearchResult) => void;
  onClaim: (result: SearchResult) => void;
  onRetry: (tldId: string) => void;
}) {
  const kind = rowKind(row);
  const styles = KIND_STYLES[kind];

  return (
    <li
      data-testid={`result-${row.name}-${row.tldId}`}
      data-status={kind}
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border px-4 py-3 ${styles.wrap} ${
        kind === "taken" ? "opacity-90" : ""
      }`}
    >
      <div className="flex items-center min-w-0">
        <FontAwesomeIcon
          icon={styles.icon}
          className={`mr-3 text-lg ${styles.iconClass}`}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="font-mono text-base md:text-lg font-semibold text-gray-900 break-all">
            {row.fullDomain}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold tracking-wide ${styles.badge}`}
            >
              {styles.badgeText}
            </span>
            <span className="text-gray-500">on .{row.tldName}</span>
            {kind === "taken" && row.reason === "reserved" && (
              <span className="text-gray-500 italic">reserved</span>
            )}
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
            Claim / Add to Cart
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
