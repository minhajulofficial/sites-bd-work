import "server-only";

import {
  createServerSupabase,
  createServiceSupabase,
} from "@/lib/supabase/server";
import type { Database, Json } from "@/types/supabase";

import {
  type CartAddon,
  type CartItem,
  type CartItemInput,
  type CartItemPatch,
} from "./types";

/**
 * Server-side cart store.
 *
 * For logged-in users this persists into `public.cart_items`. The
 * table uses a UUID `tld_id` foreign key, but everywhere else in the
 * code the TLD is identified by its public slug (`"esite-top"`); this
 * module owns the slug ↔ UUID translation so callers (route handlers,
 * the merge endpoint) never see the surrogate key.
 *
 * Guest persistence lives client-side in `sessionStorage` and never
 * touches the database — see `src/lib/cart/guestCart.ts`. The
 * server-side cart is only ever exposed to authenticated requests.
 */

type CartRow = Database["public"]["Tables"]["cart_items"]["Row"];
type CartInsert = Database["public"]["Tables"]["cart_items"]["Insert"];
type CartUpdate = Database["public"]["Tables"]["cart_items"]["Update"];

export class CartStoreError extends Error {
  public readonly code: string;
  public readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "CartStoreError";
    this.code = code;
    this.status = status;
  }
}

function rowToCartItem(row: CartRow, tldSlug: string): CartItem {
  return {
    id: row.id,
    tldId: tldSlug,
    name: row.domain_name,
    fullDomain: row.full_domain,
    hostingType: row.hosting_type,
    hostingPlanId: row.hosting_plan_id,
    customNsValues: row.custom_ns_values,
    customIpValue: row.custom_ip_value,
    addons: normaliseAddons(row.addons),
    addedAt: row.created_at,
  };
}

function normaliseAddons(value: Json): CartAddon[] {
  if (!Array.isArray(value)) return [];
  const result: CartAddon[] = [];
  for (const v of value) {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      result.push(v as unknown as CartAddon);
    }
  }
  return result;
}

/**
 * Look up a TLD's database UUID by its registry slug. Uses the
 * service-role client so this works for guest sessions too — the
 * RLS policy on `tlds` is admin-only for writes but allows public
 * reads via the service-role bypass we already use in domain search.
 */
async function getTldUuidBySlug(slug: string): Promise<string | null> {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("tlds")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[cart/store] tld lookup failed", error);
    throw new CartStoreError(
      "internal_error",
      "Could not resolve TLD",
      500,
    );
  }
  if (!data) return null;
  return (data as { id: string }).id;
}

/**
 * Inverse of `getTldUuidBySlug`. Cached behind a fresh
 * service-role client per call — `cart_items` is small and the round
 * trip is cheap, but if this ever becomes hot we can lift the lookup
 * into the registry.
 */
async function getTldSlugMapByUuids(
  uuids: string[],
): Promise<Map<string, string>> {
  if (uuids.length === 0) return new Map();
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("tlds")
    .select("id, slug")
    .in("id", uuids);
  if (error) {
    console.error("[cart/store] tld batch lookup failed", error);
    throw new CartStoreError(
      "internal_error",
      "Could not resolve TLDs",
      500,
    );
  }
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { id: string; slug: string }[]) {
    map.set(row.id, row.slug);
  }
  return map;
}

export async function listCartForUser(userId: string): Promise<CartItem[]> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("cart_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[cart/store] list failed", error);
    throw new CartStoreError("internal_error", "Could not load cart", 500);
  }
  const rows = (data ?? []) as CartRow[];
  const slugMap = await getTldSlugMapByUuids(
    Array.from(new Set(rows.map((r) => r.tld_id))),
  );
  return rows.map((row) => rowToCartItem(row, slugMap.get(row.tld_id) ?? ""));
}

/**
 * Add a single item for a logged-in user. Returns `{ kind: "added" }`
 * on insert success, `{ kind: "duplicate" }` if the user already has
 * the same `(tldId, name)` pair in their cart (callers translate this
 * to a 409). The check is done via a SELECT-then-INSERT pair rather
 * than a unique constraint because the `cart_items` table doesn't
 * declare one — see `supabase/migrations/0001_init.sql`.
 */
export async function addItemForUser(
  userId: string,
  input: CartItemInput,
): Promise<
  { kind: "added"; item: CartItem } | { kind: "duplicate"; item: CartItem }
> {
  const tldUuid = await getTldUuidBySlug(input.tldId);
  if (!tldUuid) {
    throw new CartStoreError("invalid_tld", "Unknown TLD", 400);
  }

  const supabase = createServerSupabase();

  const { data: existing, error: existingErr } = await supabase
    .from("cart_items")
    .select("*")
    .eq("user_id", userId)
    .eq("tld_id", tldUuid)
    .eq("domain_name", input.name)
    .maybeSingle();
  if (existingErr) {
    console.error("[cart/store] dedupe lookup failed", existingErr);
    throw new CartStoreError(
      "internal_error",
      "Could not check cart",
      500,
    );
  }
  if (existing) {
    return {
      kind: "duplicate",
      item: rowToCartItem(existing as CartRow, input.tldId),
    };
  }

  const insert: CartInsert = {
    user_id: userId,
    tld_id: tldUuid,
    domain_name: input.name,
    full_domain: input.fullDomain,
    hosting_type: input.hostingType ?? null,
    hosting_plan_id: input.hostingPlanId ?? null,
    custom_ns_values: input.customNsValues ?? null,
    custom_ip_value: input.customIpValue ?? null,
    addons: (input.addons ?? []) as unknown as Json,
  };
  const { data, error } = await supabase
    .from("cart_items")
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) {
    console.error("[cart/store] insert failed", error);
    throw new CartStoreError("internal_error", "Could not add to cart", 500);
  }
  return {
    kind: "added",
    item: rowToCartItem(data as CartRow, input.tldId),
  };
}

export async function updateItemForUser(
  userId: string,
  itemId: string,
  patch: CartItemPatch,
): Promise<CartItem | null> {
  const supabase = createServerSupabase();
  const update: CartUpdate = {};
  if (patch.hostingType !== undefined) update.hosting_type = patch.hostingType;
  if (patch.hostingPlanId !== undefined)
    update.hosting_plan_id = patch.hostingPlanId;
  if (patch.customNsValues !== undefined)
    update.custom_ns_values = patch.customNsValues;
  if (patch.customIpValue !== undefined)
    update.custom_ip_value = patch.customIpValue;
  if (patch.addons !== undefined)
    update.addons = patch.addons as unknown as Json;
  // Always bump updated_at on patch — the trigger already does this,
  // but being explicit means a read-after-write in the same request
  // doesn't see a stale timestamp if the trigger ever changes.
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("cart_items")
    .update(update)
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[cart/store] update failed", error);
    throw new CartStoreError("internal_error", "Could not update item", 500);
  }
  if (!data) return null;
  const row = data as CartRow;
  const slugMap = await getTldSlugMapByUuids([row.tld_id]);
  return rowToCartItem(row, slugMap.get(row.tld_id) ?? "");
}

export async function removeItemForUser(
  userId: string,
  itemId: string,
): Promise<boolean> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("id");
  if (error) {
    console.error("[cart/store] delete failed", error);
    throw new CartStoreError("internal_error", "Could not remove item", 500);
  }
  return (data ?? []).length > 0;
}

/**
 * Clear the entire cart for a user. Invoked from the post-checkout
 * pathway in PR-15 — exposed here so we have one place for that
 * concern.
 */
export async function clearCartForUser(userId: string): Promise<number> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .select("id");
  if (error) {
    console.error("[cart/store] clear failed", error);
    throw new CartStoreError("internal_error", "Could not clear cart", 500);
  }
  return (data ?? []).length;
}

/**
 * Merge a guest sessionStorage payload into the user's DB cart.
 *
 * Dedupe rules per PRD §3.2: drop any incoming row whose `(tldId,
 * name)` pair is already in the user's DB cart — DB wins. Returns the
 * final cart so the client can hydrate immediately without a follow-up
 * round-trip.
 *
 * Tolerant of unknown TLD slugs — those rows are silently dropped
 * rather than failing the whole merge.
 */
export async function mergeGuestCartIntoUser(
  userId: string,
  guestItems: CartItemInput[],
): Promise<{ items: CartItem[]; mergedCount: number; skipped: number }> {
  if (guestItems.length === 0) {
    const items = await listCartForUser(userId);
    return { items, mergedCount: 0, skipped: 0 };
  }

  // Resolve every distinct slug up front so we can build the
  // INSERT in one pass.
  const distinctSlugs = Array.from(
    new Set(guestItems.map((i) => i.tldId)),
  );
  const supabase = createServiceSupabase();
  const { data: tldRows, error: tldErr } = await supabase
    .from("tlds")
    .select("id, slug")
    .in("slug", distinctSlugs);
  if (tldErr) {
    console.error("[cart/store] merge tld lookup failed", tldErr);
    throw new CartStoreError(
      "internal_error",
      "Could not resolve TLDs",
      500,
    );
  }
  const slugToUuid = new Map<string, string>();
  for (const row of (tldRows ?? []) as { id: string; slug: string }[]) {
    slugToUuid.set(row.slug, row.id);
  }

  // Load existing rows so we can dedupe against them in-process. The
  // cart is bounded (a few rows per user) so this is cheap.
  const existing = await listCartForUser(userId);
  const existingKeys = new Set(
    existing.map((i) => `${i.tldId}\u0000${i.name}`),
  );

  let merged = 0;
  let skipped = 0;
  for (const input of guestItems) {
    const tldUuid = slugToUuid.get(input.tldId);
    if (!tldUuid) {
      skipped += 1;
      continue;
    }
    const key = `${input.tldId}\u0000${input.name}`;
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }

    const insert: CartInsert = {
      user_id: userId,
      tld_id: tldUuid,
      domain_name: input.name,
      full_domain: input.fullDomain,
      hosting_type: input.hostingType ?? null,
      hosting_plan_id: input.hostingPlanId ?? null,
      custom_ns_values: input.customNsValues ?? null,
      custom_ip_value: input.customIpValue ?? null,
      addons: (input.addons ?? []) as unknown as Json,
    };
    const userSupabase = createServerSupabase();
    const { error } = await userSupabase
      .from("cart_items")
      .insert(insert);
    if (error) {
      console.error("[cart/store] merge insert failed", error);
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    merged += 1;
  }

  const items = await listCartForUser(userId);
  return { items, mergedCount: merged, skipped };
}
