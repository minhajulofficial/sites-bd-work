"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faSpinner } from "@fortawesome/free-solid-svg-icons";

import type { TldEntry } from "@/lib/domains/registry";
import { normaliseNames, parseQueryString } from "@/lib/domain/shared";

export type SearchBarSubmit = {
  query: string;
  names: string[];
  selectedTldIds: string[];
};

type SearchBarBaseProps = {
  initialQuery?: string;
  loading?: boolean;
  onSubmit: (payload: SearchBarSubmit) => void;
  textareaPlaceholder?: string;
  className?: string;
  submitLabel?: string;
  /**
   * If `true`, renders a multi-line textarea instead of a single input so
   * users can paste comma- or newline-separated bulk lists. Defaults to
   * `true` because the brief calls for bulk input support.
   */
  multiline?: boolean;
};

type SearchBarDefaultProps = SearchBarBaseProps & {
  mode?: "default";
  tlds: TldEntry[];
  initialSelectedTldIds?: string[];
};

type SearchBarSingleTldProps = SearchBarBaseProps & {
  mode: "single";
  tld: TldEntry;
};

export type SearchBarProps = SearchBarDefaultProps | SearchBarSingleTldProps;

/**
 * Reusable domain search input.
 *
 *   - **default** mode  — bulk-input textarea (comma / newline / whitespace
 *     separated) PLUS a multi-select chip group of every enabled TLD.
 *   - **single** mode   — single-line input with a fixed `.<tld>` suffix.
 *
 * Validates client-side using `normaliseNames`; surfaces the first
 * invalid name as an inline error so the user can fix it without a
 * round-trip to the server.
 */
export function SearchBar(props: SearchBarProps) {
  const {
    initialQuery = "",
    loading = false,
    onSubmit,
    className = "",
    submitLabel = "Check Availability",
    multiline = true,
  } = props;

  const [query, setQuery] = useState<string>(initialQuery);
  const [error, setError] = useState<string | null>(null);

  // Multi-select state lives here so the component is self-contained.
  const isSingle = props.mode === "single";
  const singleTld = isSingle ? props.tld : null;
  const multiTlds = !isSingle ? props.tlds : null;
  const propsInitialTldIds = !isSingle ? props.initialSelectedTldIds : null;
  const allTlds = useMemo<TldEntry[]>(
    () => (singleTld ? [singleTld] : (multiTlds ?? [])),
    [singleTld, multiTlds],
  );
  const initialSelected = useMemo<string[]>(() => {
    if (singleTld) return [singleTld.id];
    if (propsInitialTldIds && propsInitialTldIds.length > 0) {
      const allowed = new Set(allTlds.map((t) => t.id));
      const filtered = propsInitialTldIds.filter((id) => allowed.has(id));
      if (filtered.length > 0) return filtered;
    }
    return allTlds.map((t) => t.id);
  }, [singleTld, propsInitialTldIds, allTlds]);
  const [selectedTldIds, setSelectedTldIds] =
    useState<string[]>(initialSelected);

  // Keep selection in sync if the parent rerenders with a different list
  // of enabled TLDs (e.g. after a config / DB toggle).
  const lastTldKey = useRef<string>("");
  useEffect(() => {
    const key = allTlds.map((t) => t.id).join(",");
    if (key === lastTldKey.current) return;
    lastTldKey.current = key;
    setSelectedTldIds((prev) => {
      const allowed = new Set(allTlds.map((t) => t.id));
      const kept = prev.filter((id) => allowed.has(id));
      // Keep "all selected" semantics when previously a no-op.
      return kept.length > 0 ? kept : allTlds.map((t) => t.id);
    });
  }, [allTlds]);

  // Keep `query` in sync if the parent feeds in a new `initialQuery`
  // (e.g. URL params change on `/check`).
  const lastInitial = useRef<string>(initialQuery);
  useEffect(() => {
    if (initialQuery !== lastInitial.current) {
      lastInitial.current = initialQuery;
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const toggleTld = (id: string) => {
    setSelectedTldIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        // Never let the user empty the selection — last chip stays on.
        return next.length > 0 ? next : prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const tokens = parseQueryString(query);
    const result = normaliseNames(tokens);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (selectedTldIds.length === 0) {
      setError("Select at least one TLD");
      return;
    }
    setError(null);
    onSubmit({
      query,
      names: result.names,
      selectedTldIds: [...selectedTldIds],
    });
  };

  const inputId = "domain-search-input";

  return (
    <form
      className={`space-y-4 ${className}`}
      onSubmit={handleSubmit}
      noValidate
    >
      <div>
        <label htmlFor={inputId} className="sr-only">
          Subdomain name(s)
        </label>
        <div className="flex items-stretch bg-white rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden">
          {multiline ? (
            <textarea
              id={inputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={2}
              placeholder={
                props.textareaPlaceholder ??
                "Enter one or more names — separate with commas or new lines"
              }
              className="flex-1 text-base md:text-lg font-medium bg-transparent border-none px-4 py-3 focus:outline-none resize-y min-h-[3rem]"
            />
          ) : (
            <input
              id={inputId}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                props.textareaPlaceholder ?? "Enter your subdomain name"
              }
              className="flex-1 text-base md:text-lg font-medium bg-transparent border-none px-4 py-3 focus:outline-none"
            />
          )}
          {isSingle && (
            <span className="flex items-center justify-center px-4 text-base md:text-lg font-semibold text-gray-600 border-l border-gray-300 select-none">
              .{props.tld.name}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {multiline
            ? "Tip: paste multiple names — separate with commas, spaces or newlines."
            : "Example: bdshop, arman-mia"}
        </p>
      </div>

      {!isSingle && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-gray-700">
            Check against:
          </legend>
          <div
            role="group"
            aria-label="Select which parent domains to check"
            className="flex flex-wrap gap-2"
          >
            {allTlds.map((tld) => {
              const active = selectedTldIds.includes(tld.id);
              return (
                <button
                  type="button"
                  key={tld.id}
                  onClick={() => toggleTld(tld.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-gray-300 bg-white text-gray-700 hover:border-primary hover:text-primary"
                  }`}
                >
                  .{tld.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {error && (
        <div
          role="alert"
          className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full primary-gradient text-white py-3 md:py-4 rounded-lg font-bold text-base md:text-lg hover-lift disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center"
      >
        <FontAwesomeIcon
          icon={loading ? faSpinner : faSearch}
          className={`mr-2 ${loading ? "animate-spin" : ""}`}
        />
        {loading ? "Checking…" : submitLabel}
      </button>
    </form>
  );
}
