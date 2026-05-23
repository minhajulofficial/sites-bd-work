/**
 * Shared cart types used by every cart consumer (the React hook,
 * the sessionStorage guest store, the server-side DB store, and the
 * `/api/cart/*` route handlers).
 *
 * Every cart item is for a `(tldId, name)` pair — the product is
 * multi-TLD so the cart MUST carry both. `fullDomain` is denormalised
 * onto every row so the UI never has to look up the TLD's parent name
 * to render it.
 *
 * `tldId` is the public TLD slug (e.g. `"esite-top"`) — the same
 * identifier exposed by `src/lib/domains/registry.ts`. The server
 * cart store translates this to / from the `tlds.id` UUID at the DB
 * boundary so neither the API surface nor the client has to know
 * about the database's surrogate key.
 */

/**
 * Hosting bucket the cart row should provision once the order is
 * paid. Mirrors `public.cart_hosting_type` in the DB.
 */
export type CartHostingType = "premium" | "free" | "custom_ns" | "custom_ip";

/**
 * Free-form addon attached to a cart row. The shape is preserved as
 * JSON in `cart_items.addons`; we don't currently constrain the
 * schema beyond "must be JSON-safe".
 */
export type CartAddon = Record<string, unknown>;

/**
 * Public-facing cart item shape used by the API + the React hook.
 *
 * For logged-in users `id` is the `cart_items.id` UUID; for guests it
 * is a client-generated stable id (so the UI can key + update / remove
 * a specific row).
 */
export interface CartItem {
  /** Stable id. UUID for DB-backed rows, client-generated for guests. */
  id: string;
  tldId: string;
  name: string;
  fullDomain: string;
  hostingType: CartHostingType | null;
  hostingPlanId: string | null;
  customNsValues: string[] | null;
  customIpValue: string | null;
  addons: CartAddon[];
  /** ISO-8601 string. `created_at` for DB rows, a fresh stamp for guests. */
  addedAt: string;
}

/**
 * Patch payload accepted by `updateItem`. Only the mutable fields are
 * editable — `tldId` / `name` / `fullDomain` are part of the row's
 * identity and can't be changed in-place.
 */
export interface CartItemPatch {
  hostingType?: CartHostingType | null;
  hostingPlanId?: string | null;
  customNsValues?: string[] | null;
  customIpValue?: string | null;
  addons?: CartAddon[];
}

/**
 * Input shape accepted by `addItem`. Optional hosting / addon fields
 * default to `null` / `[]` server-side.
 */
export interface CartItemInput {
  tldId: string;
  name: string;
  fullDomain: string;
  hostingType?: CartHostingType | null;
  hostingPlanId?: string | null;
  customNsValues?: string[] | null;
  customIpValue?: string | null;
  addons?: CartAddon[];
}

/**
 * Wire shape of `GET /api/cart`.
 *
 * - `mode: "user"` → request was authenticated; `items` is the DB
 *   cart for that user.
 * - `mode: "guest"` → no session; the client should fall back to
 *   `sessionStorage.guestCart`. `items` is always an empty array
 *   in this branch so callers don't have to special-case `null`.
 */
export type CartFetchResponse =
  | { mode: "user"; items: CartItem[] }
  | { mode: "guest"; items: CartItem[] };

/** sessionStorage key under which the guest cart is persisted. */
export const GUEST_CART_KEY = "guestCart";
