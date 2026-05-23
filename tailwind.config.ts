import type { Config } from "tailwindcss";

/**
 * Tailwind theme is configured to match the legacy homepage (legacy/index.html).
 * Brand palette is the royal blue family used by the legacy `.primary-gradient`
 * and `text-primary` utilities, intentionally preserved so the ported homepage
 * remains pixel-for-pixel identical.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/components/**/*.{ts,tsx,js,jsx,mdx}",
    "./src/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#3b82f6",
          light: "#60a5fa",
          dark: "#1e40af",
          deep: "#1d4ed8",
        },
      },
      backgroundImage: {
        "primary-gradient":
          "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #1e40af 100%)",
        "success-gradient":
          "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
        "purple-gradient":
          "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-15px)" },
        },
        "pulse-glow": {
          "0%,100%": { boxShadow: "0 0 20px rgba(59, 130, 246, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(59, 130, 246, 0.6)" },
        },
        typing: {
          from: { width: "0" },
          to: { width: "100%" },
        },
        "blink-caret": {
          "0%,100%": { borderColor: "transparent" },
          "50%": { borderColor: "#3b82f6" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s infinite",
        typing:
          "typing 3s steps(30, end), blink-caret 0.75s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
