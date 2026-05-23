"use client";

import type { SearchResult } from "./shared";

/**
 * Client-side wrapper for `POST /api/domain/check`. The server route
 * accepts either `names` (already-tokenised array) or `query` (raw
 * string); we always send `names` here because the UI tokenises and
 * validates client-side before calling.
 */
export type SearchRequest = {
  names: string[];
  tldIds?: string[];
  signal?: AbortSignal;
};

export type SearchError = {
  code: string;
  message: string;
};

export async function searchDomains(
  req: SearchRequest,
): Promise<{ ok: true; results: SearchResult[] } | { ok: false; error: SearchError }> {
  const { names, tldIds, signal } = req;
  let res: Response;
  try {
    res = await fetch("/api/domain/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        names,
        ...(tldIds && tldIds.length > 0 ? { tldIds } : {}),
      }),
      signal,
    });
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") {
      return { ok: false, error: { code: "aborted", message: "Search cancelled" } };
    }
    return {
      ok: false,
      error: {
        code: "network_error",
        message: "Could not reach the search service. Please try again.",
      },
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      error: { code: "invalid_response", message: "Server returned a bad response" },
    };
  }

  if (!res.ok) {
    const err = (body as { error?: SearchError })?.error;
    return {
      ok: false,
      error: {
        code: err?.code ?? "request_failed",
        message: err?.message ?? `Search failed (HTTP ${res.status})`,
      },
    };
  }

  const data = (body as { data?: { results?: SearchResult[] } })?.data;
  return { ok: true, results: data?.results ?? [] };
}
