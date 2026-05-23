"use client";

/**
 * Thin client-side wrapper around the `/api/cart/*` routes. Exposes a
 * `{ ok, ... }` discriminated union mirroring the rest of the
 * client-side fetchers (see `src/lib/domain/client.ts`) so call sites
 * can branch on `ok` without try/catch noise.
 *
 * Only used from the React hook + the post-login merge handler — UI
 * components should call `useCart()` instead of these directly.
 */

import type {
  CartFetchResponse,
  CartItem,
  CartItemInput,
  CartItemPatch,
} from "./types";

type ErrorEnvelope = {
  error?: { code?: unknown; message?: unknown };
};

type AnyResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

async function parseError(res: Response): Promise<ApiError> {
  let envelope: ErrorEnvelope | null = null;
  try {
    envelope = (await res.json()) as ErrorEnvelope;
  } catch {
    /* fall through to generic message */
  }
  const code =
    envelope?.error?.code && typeof envelope.error.code === "string"
      ? envelope.error.code
      : `http_${res.status}`;
  const message =
    envelope?.error?.message && typeof envelope.error.message === "string"
      ? envelope.error.message
      : res.statusText || "Request failed";
  return { code, message, status: res.status };
}

export async function fetchCart(): Promise<AnyResult<CartFetchResponse>> {
  try {
    const res = await fetch("/api/cart", {
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: await parseError(res) };
    }
    const json = (await res.json()) as { data: CartFetchResponse };
    return { ok: true, data: json.data };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message:
          err instanceof Error ? err.message : "Could not contact the server",
        status: 0,
      },
    };
  }
}

export async function apiAddCartItem(
  input: CartItemInput,
): Promise<AnyResult<CartItem>> {
  try {
    const res = await fetch("/api/cart/items", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      return { ok: false, error: await parseError(res) };
    }
    const json = (await res.json()) as { data: { item: CartItem } };
    return { ok: true, data: json.data.item };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message:
          err instanceof Error ? err.message : "Could not contact the server",
        status: 0,
      },
    };
  }
}

export async function apiPatchCartItem(
  id: string,
  patch: CartItemPatch,
): Promise<AnyResult<CartItem>> {
  try {
    const res = await fetch(`/api/cart/items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      return { ok: false, error: await parseError(res) };
    }
    const json = (await res.json()) as { data: { item: CartItem } };
    return { ok: true, data: json.data.item };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message:
          err instanceof Error ? err.message : "Could not contact the server",
        status: 0,
      },
    };
  }
}

export async function apiDeleteCartItem(
  id: string,
): Promise<AnyResult<{ removed: true }>> {
  try {
    const res = await fetch(`/api/cart/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: await parseError(res) };
    }
    return { ok: true, data: { removed: true } };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message:
          err instanceof Error ? err.message : "Could not contact the server",
        status: 0,
      },
    };
  }
}

export async function apiMergeGuestCart(
  items: CartItemInput[],
): Promise<
  AnyResult<{ items: CartItem[]; mergedCount: number; skippedCount: number }>
> {
  try {
    const res = await fetch("/api/cart/merge-guest", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      return { ok: false, error: await parseError(res) };
    }
    const json = (await res.json()) as {
      data: {
        items: CartItem[];
        mergedCount: number;
        skippedCount: number;
      };
    };
    return { ok: true, data: json.data };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "network_error",
        message:
          err instanceof Error ? err.message : "Could not contact the server",
        status: 0,
      },
    };
  }
}
