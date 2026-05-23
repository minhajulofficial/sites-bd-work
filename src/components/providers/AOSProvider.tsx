"use client";

import { useEffect } from "react";
import AOS from "aos";

/**
 * Initialises the AOS scroll animation library once on the client. The CSS
 * is loaded via a CDN <link> tag in `app/layout.tsx` to preserve the legacy
 * homepage behaviour exactly.
 */
export function AOSProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
      offset: 100,
    });
  }, []);

  return <>{children}</>;
}
