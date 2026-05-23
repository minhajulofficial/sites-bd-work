"use client";

/**
 * sessionStorage-backed guest cart.
 *
 * Mirrors the public `CartItem` shape so the React hook can flip
 * between guest and user modes without changing its public surface.
 * Persisted under `sessionStorage.guestCart` (key exported as
 * `GUEST_CART_KEY` from `./types`).
 *
 * Every mutator dispatches a `guest-cart-changed` window event so any
 * `useCart()` instance mounted in another tree (e.g. the drawer + the
 * header badge) re-reads the latest contents.
 */

import {
  GUEST_CART_KEY,
  type CartAddon,
  type CartHostingType,
  type CartItem,
  type CartItemInput,
  type CartItemPatch,
} from "./types";

/** Cross-component change signal — fires for any local guest mutation. */
export const GUEST_CART_CHANGE_EVENT = "sites-bd:guest-cart-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isCartHostingType(value: unknown): value is CartHostingType {
  return (
    value === "premium" ||
    value === "free" ||
    value === "custom_ns" ||
    value === "custom_ip"
  );
}

function isStringArrayOrNull(value: unknown): value is string[] | null {
  if (value === null) return true;
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isAddonArray(value: unknown): value is CartAddon[] {
  return (
    Array.isArray(value) &&
    value.every((v) => typeof v === "object" && v !== null && !Array.isArray(v))
  );
}

function isGuestCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.tldId === "string" &&
    v.tldId.length > 0 &&
    typeof v.name === "string" &&
    v.name.length > 0 &&
    typeof v.fullDomain === "string" &&
    v.fullDomain.length > 0 &&
    (v.hostingType === null || isCartHostingType(v.hostingType)) &&
    isStringOrNull(v.hostingPlanId) &&
    isStringArrayOrNull(v.customNsValues) &&
    isStringOrNull(v.customIpValue) &&
    isAddonArray(v.addons) &&
    typeof v.addedAt === "string"
  );
}

function generateGuestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — collisions are extremely unlikely
  // within a single sessionStorage scope.
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function notifyChange(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(GUEST_CART_CHANGE_EVENT));
}

export function readGuestCart(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.sessionStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGuestCartItem);
  } catch {
    return [];
  }
}

function writeGuestCart(items: CartItem[]): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    /* quota / private browsing — silently no-op */
  }
}

/**
 * Add an item to the guest cart. Dedupes on `(tldId, name)` —
 * returns `null` on a duplicate so the caller can show a "already
 * in cart" hint without doubling the badge count.
 */
export function addGuestCartItem(input: CartItemInput): CartItem | null {
  const current = readGuestCart();
  const dupe = current.some(
    (i) => i.tldId === input.tldId && i.name === input.name,
  );
  if (dupe) return null;
  const item: CartItem = {
    id: generateGuestId(),
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
  writeGuestCart([...current, item]);
  notifyChange();
  return item;
}

export function removeGuestCartItem(id: string): boolean {
  const current = readGuestCart();
  const next = current.filter((i) => i.id !== id);
  if (next.length === current.length) return false;
  writeGuestCart(next);
  notifyChange();
  return true;
}

export function updateGuestCartItem(
  id: string,
  patch: CartItemPatch,
): CartItem | null {
  const current = readGuestCart();
  let updated: CartItem | null = null;
  const next = current.map((item) => {
    if (item.id !== id) return item;
    updated = {
      ...item,
      ...(patch.hostingType !== undefined
        ? { hostingType: patch.hostingType }
        : {}),
      ...(patch.hostingPlanId !== undefined
        ? { hostingPlanId: patch.hostingPlanId }
        : {}),
      ...(patch.customNsValues !== undefined
        ? { customNsValues: patch.customNsValues }
        : {}),
      ...(patch.customIpValue !== undefined
        ? { customIpValue: patch.customIpValue }
        : {}),
      ...(patch.addons !== undefined ? { addons: patch.addons } : {}),
    };
    return updated;
  });
  if (!updated) return null;
  writeGuestCart(next);
  notifyChange();
  return updated;
}

export function clearGuestCart(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(GUEST_CART_KEY);
  } catch {
    /* no-op */
  }
  notifyChange();
}
