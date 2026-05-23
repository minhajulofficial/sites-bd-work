"use client";

/**
 * `useCart()` — the single React surface for the global cart.
 *
 * The cart is dual-mode:
 *
 *   - **User mode.** When the session cookie identifies a signed-in
 *     user the cart is persisted server-side in `cart_items` and every
 *     mutation routes through `/api/cart/*`.
 *   - **Guest mode.** When there is no session the cart lives in
 *     `sessionStorage.guestCart`. Mutations are entirely local and
 *     bubble through the `guest-cart-changed` window event so multiple
 *     `useCart()` consumers in the tree stay in sync.
 *
 * The hook itself only reads from the `<CartProvider>` context — the
 * provider, mounted once at the root, does the initial fetch + holds
 * the canonical state. This keeps re-render granularity manageable
 * (header badge, drawer, and any future inline list all read the same
 * memoized value) and means a single mount = one network round trip.
 *
 * Every cart item carries `tldId` (registry slug) because every claim
 * is a `(tldId, name)` pair, not just a name.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  apiAddCartItem,
  apiDeleteCartItem,
  apiMergeGuestCart,
  apiPatchCartItem,
  fetchCart,
  type ApiError,
} from "@/lib/cart/cartClient";
import {
  GUEST_CART_CHANGE_EVENT,
  addGuestCartItem,
  clearGuestCart,
  readGuestCart,
  removeGuestCartItem,
  updateGuestCartItem,
} from "@/lib/cart/guestCart";
import type {
  CartItem,
  CartItemInput,
  CartItemPatch,
} from "@/lib/cart/types";
import { GUEST_CART_KEY } from "@/lib/cart/types";

export type CartMode = "loading" | "user" | "guest";

export interface CartApi {
  /** Current items in the cart. Empty until the initial fetch resolves. */
  items: CartItem[];
  /** Number of items currently in the cart. */
  count: number;
  /**
   * Best-effort BDT subtotal across all rows. PR-15 will wire pricing
   * into hosting plans + addons; until then this is `0`.
   */
  total: number;
  /**
   * Current persistence mode. Components rarely need to inspect this
   * — the API is identical between user and guest — but it's exposed
   * so the post-login merge hook can detect a transition.
   */
  mode: CartMode;
  /**
   * Whether the initial GET /api/cart is still in flight. Use this to
   * defer rendering the empty state if you want to avoid a flash.
   */
  loading: boolean;
  /** Last error from the API or guest cart (cleared on next success). */
  error: ApiError | null;
  addItem: (input: CartItemInput) => Promise<AddItemResult>;
  removeItem: (id: string) => Promise<boolean>;
  updateItem: (id: string, patch: CartItemPatch) => Promise<CartItem | null>;
  /** Empty the cart. Logged-in users issue N DELETEs; guests wipe sessionStorage. */
  clear: () => Promise<void>;
  /** Force the provider to re-fetch from `/api/cart`. */
  refresh: () => Promise<void>;
  /**
   * POST sessionStorage.guestCart to /api/cart/merge-guest. Called by
   * the dashboard layout immediately after sign-in / registration so
   * any items added as a guest survive the auth transition.
   */
  mergeGuestCart: () => Promise<MergeGuestResult>;
}

export type AddItemResult =
  | { kind: "added"; item: CartItem }
  | { kind: "duplicate"; item: CartItem | null }
  | { kind: "error"; error: ApiError };

export type MergeGuestResult =
  | { kind: "no-guest-cart" }
  | { kind: "merged"; mergedCount: number; skippedCount: number }
  | { kind: "error"; error: ApiError };

const CartContext = createContext<CartApi | null>(null);

function buildItemFromInput(input: CartItemInput): CartItem {
  return {
    id: "tmp",
    tldId: input.tldId,
    name: input.name,
    fullDomain: input.fullDomain,
    hostingType: input.hostingType ?? null,
    hostingPlanId: input.hostingPlanId ?? null,
    customNsValues: input.customNsValues ?? null,
    customIpValue: input.customIpValue ?? null,
    addons: input.addons ?? [],
    addedAt: new Date().toISOString(),
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CartMode>("loading");
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const modeRef = useRef<CartMode>("loading");

  const setModeBoth = useCallback((next: CartMode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchCart();
    if (!res.ok) {
      // Surface the error but still flip to guest mode so the UI is
      // usable — readGuestCart() is safe in any state.
      setError(res.error);
      setModeBoth("guest");
      setItems(readGuestCart());
      setLoading(false);
      return;
    }
    setError(null);
    if (res.data.mode === "user") {
      // Drain any leftover guest cart into the DB before settling on
      // the final item set, so a user who just signed in sees a fully
      // merged cart on first render rather than an empty one that
      // flips to non-empty a moment later.
      const guestItems = readGuestCart();
      if (guestItems.length > 0) {
        const payload: CartItemInput[] = guestItems.map((g) => ({
          tldId: g.tldId,
          name: g.name,
          fullDomain: g.fullDomain,
          hostingType: g.hostingType,
          hostingPlanId: g.hostingPlanId,
          customNsValues: g.customNsValues,
          customIpValue: g.customIpValue,
          addons: g.addons,
        }));
        const mergeRes = await apiMergeGuestCart(payload);
        if (mergeRes.ok) {
          clearGuestCart();
          setItems(mergeRes.data.items);
        } else {
          // Merge failed — keep the guest cart around for a retry on
          // the next refresh() and fall back to the server's view.
          setItems(res.data.items);
        }
      } else {
        setItems(res.data.items);
      }
      setModeBoth("user");
    } else {
      setModeBoth("guest");
      setItems(readGuestCart());
    }
    setLoading(false);
  }, [setModeBoth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-read the guest cart any time sessionStorage / another tab
  // bumps it. We ignore the storage event in user mode — the DB is
  // authoritative there.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GUEST_CART_KEY) return;
      if (modeRef.current !== "guest") return;
      setItems(readGuestCart());
    };
    const onChange = () => {
      if (modeRef.current !== "guest") return;
      setItems(readGuestCart());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(GUEST_CART_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(GUEST_CART_CHANGE_EVENT, onChange);
    };
  }, []);

  const addItem = useCallback<CartApi["addItem"]>(
    async (input) => {
      if (modeRef.current === "user") {
        const res = await apiAddCartItem(input);
        if (!res.ok) {
          if (res.error.code === "duplicate_item") {
            return { kind: "duplicate", item: null };
          }
          setError(res.error);
          return { kind: "error", error: res.error };
        }
        setError(null);
        setItems((prev) =>
          prev.some((i) => i.id === res.data.id) ? prev : [...prev, res.data],
        );
        return { kind: "added", item: res.data };
      }
      // Guest branch — purely local.
      const item = addGuestCartItem(input);
      if (!item) {
        const existing =
          readGuestCart().find(
            (i) => i.tldId === input.tldId && i.name === input.name,
          ) ?? null;
        return { kind: "duplicate", item: existing };
      }
      setItems(readGuestCart());
      return { kind: "added", item };
    },
    [],
  );

  const removeItem = useCallback<CartApi["removeItem"]>(async (id) => {
    if (modeRef.current === "user") {
      const res = await apiDeleteCartItem(id);
      if (!res.ok) {
        if (res.error.status === 404) {
          // Already gone — drop locally and call it a success.
          setItems((prev) => prev.filter((i) => i.id !== id));
          return true;
        }
        setError(res.error);
        return false;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
      return true;
    }
    const removed = removeGuestCartItem(id);
    if (removed) setItems(readGuestCart());
    return removed;
  }, []);

  const updateItem = useCallback<CartApi["updateItem"]>(
    async (id, patch) => {
      if (modeRef.current === "user") {
        const res = await apiPatchCartItem(id, patch);
        if (!res.ok) {
          setError(res.error);
          return null;
        }
        setItems((prev) =>
          prev.map((i) => (i.id === res.data.id ? res.data : i)),
        );
        return res.data;
      }
      const item = updateGuestCartItem(id, patch);
      if (item) setItems(readGuestCart());
      return item;
    },
    [],
  );

  const clear = useCallback<CartApi["clear"]>(async () => {
    if (modeRef.current === "user") {
      // Issue parallel deletes — the DB will fan out fast enough that
      // this is faster than a sequential loop for typical cart sizes.
      const ids = items.map((i) => i.id);
      await Promise.all(ids.map((id) => apiDeleteCartItem(id)));
      setItems([]);
      return;
    }
    clearGuestCart();
    setItems([]);
  }, [items]);

  const mergeGuestCart = useCallback<CartApi["mergeGuestCart"]>(async () => {
    const guestItems = readGuestCart();
    if (guestItems.length === 0) {
      return { kind: "no-guest-cart" };
    }
    // Strip client-only fields (`id`, `addedAt`) — the server assigns
    // its own when inserting.
    const payload: CartItemInput[] = guestItems.map((g) => ({
      tldId: g.tldId,
      name: g.name,
      fullDomain: g.fullDomain,
      hostingType: g.hostingType,
      hostingPlanId: g.hostingPlanId,
      customNsValues: g.customNsValues,
      customIpValue: g.customIpValue,
      addons: g.addons,
    }));
    const res = await apiMergeGuestCart(payload);
    if (!res.ok) {
      setError(res.error);
      return { kind: "error", error: res.error };
    }
    setError(null);
    setItems(res.data.items);
    setModeBoth("user");
    clearGuestCart();
    return {
      kind: "merged",
      mergedCount: res.data.mergedCount,
      skippedCount: res.data.skippedCount,
    };
  }, [setModeBoth]);

  const total = useMemo(() => {
    // PR-15 will wire real pricing through hosting plans + addons.
    // Until then we surface a deterministic zero so the badge / drawer
    // never display a stale or guessed amount.
    void items;
    return 0;
  }, [items]);

  const value = useMemo<CartApi>(
    () => ({
      items,
      count: items.length,
      total,
      mode,
      loading,
      error,
      addItem,
      removeItem,
      updateItem,
      clear,
      refresh,
      mergeGuestCart,
    }),
    [
      items,
      total,
      mode,
      loading,
      error,
      addItem,
      removeItem,
      updateItem,
      clear,
      refresh,
      mergeGuestCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * No-provider fallback. Returns a stable empty API so components that
 * accidentally mount outside `<CartProvider>` don't crash — they just
 * see an empty cart. Useful for storybook / unit tests.
 */
const NOOP_CART: CartApi = {
  items: [],
  count: 0,
  total: 0,
  mode: "guest",
  loading: false,
  error: null,
  addItem: async (input) => ({ kind: "added", item: buildItemFromInput(input) }),
  removeItem: async () => false,
  updateItem: async () => null,
  clear: async () => {
    /* no-op */
  },
  refresh: async () => {
    /* no-op */
  },
  mergeGuestCart: async () => ({ kind: "no-guest-cart" }),
};

export function useCart(): CartApi {
  return useContext(CartContext) ?? NOOP_CART;
}
