"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Owns the open/close state for the global `<CartDrawer>`. Mounted
 * once near the root (alongside `<CartProvider>`) so any component in
 * any layout — the dashboard `<Header>`, the marketing `<Navbar>`,
 * an inline "Added to cart" button — can call `openCartDrawer()` /
 * `closeCartDrawer()` without prop-drilling.
 */
type CartDrawerCtx = {
  open: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  toggleCartDrawer: () => void;
};

const CartDrawerContext = createContext<CartDrawerCtx | null>(null);

export function CartDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openCartDrawer = useCallback(() => setOpen(true), []);
  const closeCartDrawer = useCallback(() => setOpen(false), []);
  const toggleCartDrawer = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo<CartDrawerCtx>(
    () => ({ open, openCartDrawer, closeCartDrawer, toggleCartDrawer }),
    [open, openCartDrawer, closeCartDrawer, toggleCartDrawer],
  );

  return (
    <CartDrawerContext.Provider value={value}>
      {children}
    </CartDrawerContext.Provider>
  );
}

const NOOP: CartDrawerCtx = {
  open: false,
  openCartDrawer: () => {
    /* no-op */
  },
  closeCartDrawer: () => {
    /* no-op */
  },
  toggleCartDrawer: () => {
    /* no-op */
  },
};

export function useCartDrawer(): CartDrawerCtx {
  return useContext(CartDrawerContext) ?? NOOP;
}
