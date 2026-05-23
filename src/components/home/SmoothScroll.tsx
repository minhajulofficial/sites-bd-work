"use client";

import { useEffect } from "react";

/**
 * Mirrors the legacy jQuery smooth-scroll-on-anchor behaviour: clicks on any
 * in-page `<a href="#...">` are intercepted and smoothly scrolled with an
 * 80px offset to clear the fixed navbar.
 */
export function SmoothScroll() {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("#") || href === "#") return;
      const id = href.slice(1);
      const dest = document.getElementById(id);
      if (!dest) return;
      event.preventDefault();
      const top =
        dest.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return null;
}
