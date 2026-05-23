"use client";

import { useEffect, useState } from "react";

export type AuthUserSnapshot = {
  id: string;
  email: string;
};

export type UseAuthUserResult = {
  user: AuthUserSnapshot | null;
  loading: boolean;
};

type CacheEntry = {
  fetchedAt: number;
  user: AuthUserSnapshot | null;
};

// Module-level cache so two components mounted on the same page don't
// each issue their own /api/auth/me request on every render. The
// auth state only flips on login / logout / session expiry, so a few
// seconds of cache is fine.
let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;
const CACHE_TTL_MS = 15_000;

async function fetchAuthUser(signal?: AbortSignal): Promise<CacheEntry> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "same-origin",
        signal,
      });
      if (!res.ok) {
        const entry: CacheEntry = { fetchedAt: Date.now(), user: null };
        cache = entry;
        return entry;
      }
      const body = (await res.json()) as {
        data?: { user: AuthUserSnapshot | null };
      };
      const entry: CacheEntry = {
        fetchedAt: Date.now(),
        user: body.data?.user ?? null,
      };
      cache = entry;
      return entry;
    } catch {
      // Network failure → treat as guest, but do NOT cache so a
      // recovering tab gets a real answer on the next call.
      return { fetchedAt: 0, user: null };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Reset the cached auth-user snapshot. Call this immediately after a
 * successful login or logout so the next `useAuthUser()` consumer
 * re-fetches the fresh state instead of seeing stale data.
 */
export function invalidateAuthUserCache(): void {
  cache = null;
}

/**
 * Client hook that resolves the currently signed-in user (or `null`
 * for guests). Designed for public pages (`/`, `/check`, marketing
 * surfaces) that need to flip a UI branch based on auth without
 * forcing the host page into dynamic SSR.
 *
 * The result is cached at module scope for {@link CACHE_TTL_MS} so
 * repeated mounts on the same page reuse a single network call.
 */
export function useAuthUser(): UseAuthUserResult {
  const [state, setState] = useState<UseAuthUserResult>(() => ({
    user: cache?.user ?? null,
    loading: cache === null,
  }));

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    void fetchAuthUser(controller.signal).then((entry) => {
      if (cancelled) return;
      setState({ user: entry.user, loading: false });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return state;
}
