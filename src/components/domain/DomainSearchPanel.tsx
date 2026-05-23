"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { SearchBar, type SearchBarSubmit } from "./SearchBar";
import { SearchResults } from "./SearchResults";
import { WhoisModal } from "./WhoisModal";
import { searchDomains } from "@/lib/domain/client";
import {
  normaliseNames,
  parseQueryString,
  type SearchResult,
} from "@/lib/domain/shared";
import type { TldEntry } from "@/lib/domains/registry";

type DomainSearchPanelProps = {
  /** All enabled TLDs from the server-side registry. */
  tlds: TldEntry[];
  /**
   * When `true`, the panel syncs `?q=` / `?tldIds=` with the URL via
   * `router.replace`. Used by `/check`; the homepage opts out.
   */
  syncUrl?: boolean;
  /** Where to navigate when the user fires "Claim". Defaults to `/dash`. */
  claimRedirect?: string;
  /** Initial textarea content (e.g. coming from `?q=`). */
  initialQuery?: string;
  /** Initial selected TLD ids; defaults to every enabled TLD. */
  initialTldIds?: string[];
  /** Run the search automatically on mount if there's an initial query. */
  autoRun?: boolean;
  /** Hide the chip TLD selector — useful when the host already has one. */
  hideTldSelector?: boolean;
  /** Single-line input instead of multi-line textarea. */
  singleLineInput?: boolean;
  /** Style the inner shell inside the host section. */
  innerClassName?: string;
};

/**
 * Orchestrates the search UX:
 *
 *   - `SearchBar`     — bulk input + TLD multi-select
 *   - `SearchResults` — grouped by name, sub-grouped by TLD
 *   - `WhoisModal`    — opens when the user clicks a "Whois" button
 *
 * Also handles:
 *
 *   - URL state on `/check` (`?q=...&tldIds=...`) — read on mount,
 *     written on every successful search.
 *   - The per-TLD "Try again" retry, which merges fresh results back
 *     into the existing set rather than wiping the whole list.
 *   - Dispatching the `domain-claim` custom event for PR-13 to pick
 *     up (no cart UX is bundled here).
 */
export function DomainSearchPanel({
  tlds,
  syncUrl = false,
  claimRedirect,
  initialQuery,
  initialTldIds,
  autoRun = false,
  hideTldSelector = false,
  singleLineInput = false,
  innerClassName,
}: DomainSearchPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resolve initial state from props OR `?q=` / `?tldIds=` so the same
  // component works on the homepage (props-driven) and `/check`
  // (URL-driven).
  const allTldIds = useMemo(() => tlds.map((t) => t.id), [tlds]);

  const resolvedInitialQuery = useMemo<string>(() => {
    if (typeof initialQuery === "string") return initialQuery;
    if (syncUrl) return searchParams.get("q") ?? "";
    return "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, syncUrl]);

  const resolvedInitialTldIds = useMemo<string[]>(() => {
    if (initialTldIds && initialTldIds.length > 0) {
      const allowed = new Set(allTldIds);
      const filtered = initialTldIds.filter((id) => allowed.has(id));
      if (filtered.length > 0) return filtered;
    }
    if (syncUrl) {
      const raw = searchParams.get("tldIds");
      if (raw) {
        const allowed = new Set(allTldIds);
        const parsed = raw
          .split(",")
          .map((s) => s.trim())
          .filter((id) => allowed.has(id));
        if (parsed.length > 0) return parsed;
      }
    }
    return allTldIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTldIds, syncUrl, allTldIds.join(",")]);

  const [query, setQuery] = useState<string>(resolvedInitialQuery);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(() => new Set());
  const [whoisTarget, setWhoisTarget] = useState<SearchResult | null>(null);

  /** Remember the names + TLD set of the last successful search for retries. */
  const lastRequest = useRef<{ names: string[]; tldIds: string[] } | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(
    async (
      names: string[],
      selectedTldIds: string[],
      opts?: { rawQuery?: string; pushUrl?: boolean },
    ) => {
      // Cancel any in-flight request so a quick second submit wins.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setGlobalError(null);

      const res = await searchDomains({
        names,
        tldIds: selectedTldIds,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setLoading(false);
      setSearched(true);

      if (!res.ok) {
        if (res.error.code === "aborted") return;
        setGlobalError(res.error.message);
        setResults([]);
        return;
      }
      setResults(res.results);
      lastRequest.current = { names, tldIds: selectedTldIds };

      if (syncUrl && opts?.pushUrl !== false) {
        const params = new URLSearchParams();
        const q = opts?.rawQuery ?? names.join(", ");
        if (q) params.set("q", q);
        if (
          selectedTldIds.length > 0 &&
          selectedTldIds.length !== allTldIds.length
        ) {
          params.set("tldIds", selectedTldIds.join(","));
        }
        const next = params.toString();
        router.replace(next ? `?${next}` : "?", { scroll: false });
      }
    },
    [allTldIds, router, syncUrl],
  );

  const handleSubmit = useCallback(
    (payload: SearchBarSubmit) => {
      setQuery(payload.query);
      void runSearch(payload.names, payload.selectedTldIds, {
        rawQuery: payload.query,
      });
    },
    [runSearch],
  );

  // Auto-run if we landed with a query in the URL.
  const didAutoRunRef = useRef(false);
  useEffect(() => {
    if (!autoRun || didAutoRunRef.current) return;
    if (!resolvedInitialQuery) return;
    const tokens = parseQueryString(resolvedInitialQuery);
    const norm = normaliseNames(tokens);
    if (!norm.ok) return;
    didAutoRunRef.current = true;
    void runSearch(norm.names, resolvedInitialTldIds, {
      rawQuery: resolvedInitialQuery,
      // The URL already says what we're about to render — don't push.
      pushUrl: false,
    });
  }, [autoRun, resolvedInitialQuery, resolvedInitialTldIds, runSearch]);

  // Cancel any in-flight request on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const handleRetry = useCallback(
    async (tldId: string) => {
      const last = lastRequest.current;
      if (!last) return;
      setRetrying((prev) => {
        const next = new Set(prev);
        next.add(tldId);
        return next;
      });
      const res = await searchDomains({ names: last.names, tldIds: [tldId] });
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(tldId);
        return next;
      });
      if (!res.ok) {
        setGlobalError(res.error.message);
        return;
      }
      setResults((prev) => {
        const byKey = new Map<string, SearchResult>();
        for (const row of prev) {
          byKey.set(`${row.name}:${row.tldId}`, row);
        }
        for (const row of res.results) {
          byKey.set(`${row.name}:${row.tldId}`, row);
        }
        // Preserve original (name, tld) order from `prev` so the row
        // doesn't visually jump on retry.
        return prev.map((row) => byKey.get(`${row.name}:${row.tldId}`) ?? row);
      });
    },
    [],
  );

  const handleClaim = useCallback(
    (row: SearchResult) => {
      // PR-13 will own the actual cart wiring. We dispatch a custom
      // event so the cart code can subscribe globally without this
      // file needing to know about it. We also `console.info` for
      // visibility while the cart isn't built yet.
      if (typeof window !== "undefined") {
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
        if (claimRedirect) {
          router.push(claimRedirect);
        }
      }
    },
    [claimRedirect, router],
  );

  return (
    <div className={innerClassName ?? "space-y-6"}>
      {hideTldSelector ? (
        <SearchBar
          mode="single"
          tld={tlds[0]!}
          initialQuery={query}
          loading={loading}
          onSubmit={handleSubmit}
          multiline={!singleLineInput}
        />
      ) : (
        <SearchBar
          mode="default"
          tlds={tlds}
          initialQuery={query}
          initialSelectedTldIds={resolvedInitialTldIds}
          loading={loading}
          onSubmit={handleSubmit}
          multiline={!singleLineInput}
        />
      )}

      {globalError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {globalError}
        </div>
      )}

      <SearchResults
        results={results}
        tlds={tlds}
        loading={loading}
        searched={searched}
        retryingTldIds={retrying}
        onWhois={(r) => setWhoisTarget(r)}
        onClaim={handleClaim}
        onRetry={(tldId) => void handleRetry(tldId)}
      />

      <WhoisModal
        open={whoisTarget !== null}
        result={whoisTarget}
        onClose={() => setWhoisTarget(null)}
      />
    </div>
  );
}
