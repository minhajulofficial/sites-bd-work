"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Client-side cart hook.
 *
 * Until PR-14 wires up the server-backed cart (REST + Supabase), this
 * hook keeps the cart in `localStorage` so PR-13's claim flow has a
 * working end-to-end target: an item added via `addItem(...)` survives
 * a page navigation, drives the badge counter in the sidebar / header,
 * and shows up on `/cart`.
 *
 * The public contract — `count` + `items` + `addItem({ tldId, name,
 * fullDomain })` — is what PR-13 + the rest of the app rely on. PR-14
 * is expected to swap the localStorage backing for an `/api/cart`
 * client without changing this surface.
 *
 * Every cart item carries `tldId` (the registry id, e.g. `"esite-top"`)
 * because every claim is a `(tldId, name)` pair, not just a name.
 */
export interface CartItem {
  tldId: string;
  name: string;
  fullDomain: string;
  /** ms-epoch when the item was added. */
  addedAt: number;
}

export interface CartApi {
  /** Total number of items currently in the cart. */
  count: number;
  /** Read-only snapshot of the cart contents. */
  items: CartItem[];
  /**
   * Adds a (tldId, name) claim to the cart. No-op (returns `false`) if
   * the same pair is already in the cart so the count never doubles
   * up. Returns `true` on a fresh add.
   */
  addItem: (input: {
    tldId: string;
    name: string;
    fullDomain: string;
  }) => boolean;
}

/** Storage key used by every consumer of the localStorage-backed cart. */
const STORAGE_KEY = "sites-bd:cart";
/** Internal event the hook fires whenever the cart mutates locally. */
const CHANGE_EVENT = "sites-bd:cart-changed";

function readFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

function writeToStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* private browsing / quota — silently no-op */
  }
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.tldId === "string" &&
    typeof v.name === "string" &&
    typeof v.fullDomain === "string" &&
    typeof v.addedAt === "number"
  );
}

/**
 * Imperative add — usable from non-React code (e.g. the claim-resume
 * helper in `src/lib/cart/claimResume.ts`). Mirrors the React API but
 * works without a hook context. Returns the resulting cart so callers
 * can inspect the count.
 */
export function addCartItem(input: {
  tldId: string;
  name: string;
  fullDomain: string;
}): { added: boolean; items: CartItem[] } {
  const current = readFromStorage();
  const dupe = current.some(
    (i) => i.tldId === input.tldId && i.name === input.name,
  );
  if (dupe) return { added: false, items: current };
  const next: CartItem[] = [
    ...current,
    {
      tldId: input.tldId,
      name: input.name,
      fullDomain: input.fullDomain,
      addedAt: Date.now(),
    },
  ];
  writeToStorage(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return { added: true, items: next };
}

export function useCart(): CartApi {
  // Start at `[]` on both server and first client render to avoid a
  // hydration mismatch; the `useEffect` below pulls the persisted
  // contents in immediately after mount.
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readFromStorage());

    const sync = () => setItems(readFromStorage());
    // `storage` fires across tabs; the custom event covers same-tab
    // updates that `storage` doesn't deliver.
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const addItem = useCallback<CartApi["addItem"]>((input) => {
    const result = addCartItem(input);
    if (result.added) setItems(result.items);
    return result.added;
  }, []);

  return { count: items.length, items, addItem };
}
