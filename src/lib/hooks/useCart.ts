"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A single line-item in the cart. Every claim is keyed by the
 * `(tldId, name)` pair — PR-13 deliberately stores the parent TLD on
 * each item so cart, pricing, and provisioning can operate on the
 * exact subdomain the user selected.
 */
export interface CartItem {
  tldId: string;
  name: string;
  fullDomain: string;
  addedAt: number;
}

export type CartItemInput = Pick<CartItem, "tldId" | "name" | "fullDomain">;

/** Public hook surface — kept stable so PR-14 can replace the body. */
export interface CartSummary {
  /** All current line items in insertion order. */
  items: CartItem[];
  /** Total number of items currently in the cart. */
  count: number;
  /** Idempotent add. If the `(tldId, name)` pair is already in the
   *  cart this is a no-op rather than duplicating the row. */
  addItem: (item: CartItemInput) => CartItem;
  /** Remove a single line item by its `(tldId, name)` key. */
  removeItem: (key: { tldId: string; name: string }) => void;
  /** Drop everything currently in the cart. */
  clear: () => void;
}

const STORAGE_KEY = "sites-bd:cart:v1";
const SYNC_EVENT = "sites-bd:cart:changed";

function isCartItem(v: unknown): v is CartItem {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.tldId === "string" &&
    typeof r.name === "string" &&
    typeof r.fullDomain === "string" &&
    typeof r.addedAt === "number"
  );
}

function readStorage(): CartItem[] {
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

function writeStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENT, { detail: { items } }),
    );
  } catch {
    /* localStorage unavailable (Safari private mode etc.) — degrade
     * gracefully to per-tab in-memory state. */
  }
}

/**
 * Local-storage backed cart. PR-14 will replace the body with a
 * server-synced store (likely React Context wrapping a /api/cart
 * fetch + optimistic mutations), but the surface — `items`, `count`,
 * `addItem`, `removeItem`, `clear` — is stable.
 *
 * Multiple `useCart()` consumers on the same page stay in sync via a
 * `window` `CustomEvent` ("sites-bd:cart:changed") fired on every
 * mutation. The native `storage` event also kicks in for
 * cross-tab sync.
 */
export function useCart(): CartSummary {
  const [items, setItems] = useState<CartItem[]>(() => readStorage());

  useEffect(() => {
    const onSync = (ev: Event) => {
      const detail = (ev as CustomEvent<{ items?: CartItem[] }>).detail;
      if (detail?.items) {
        setItems(detail.items);
        return;
      }
      setItems(readStorage());
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key && ev.key !== STORAGE_KEY) return;
      setItems(readStorage());
    };
    window.addEventListener(SYNC_EVENT, onSync as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const addItem = useCallback((input: CartItemInput): CartItem => {
    const current = readStorage();
    const existing = current.find(
      (it) => it.tldId === input.tldId && it.name === input.name,
    );
    if (existing) {
      // Already in the cart — return the existing row without
      // mutating insertion order or `addedAt`.
      return existing;
    }
    const next: CartItem = {
      tldId: input.tldId,
      name: input.name,
      fullDomain: input.fullDomain,
      addedAt: Date.now(),
    };
    const updated = [...current, next];
    writeStorage(updated);
    setItems(updated);
    return next;
  }, []);

  const removeItem = useCallback(
    ({ tldId, name }: { tldId: string; name: string }) => {
      const current = readStorage();
      const updated = current.filter(
        (it) => !(it.tldId === tldId && it.name === name),
      );
      if (updated.length === current.length) return;
      writeStorage(updated);
      setItems(updated);
    },
    [],
  );

  const clear = useCallback(() => {
    writeStorage([]);
    setItems([]);
  }, []);

  return { items, count: items.length, addItem, removeItem, clear };
}
