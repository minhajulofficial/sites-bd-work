import { config } from "@fortawesome/fontawesome-svg-core";

// Prevent Font Awesome from injecting its own CSS at runtime — globals
// imports the stylesheet directly in layout.tsx so SSR + hydration match.
config.autoAddCss = false;

export const faConfig = config;
