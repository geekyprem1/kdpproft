import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── KDP Profit Machine brand (blue) ──
        // NOTE: token keys kept as `gold*` for backwards-compat with existing
        // `brand-gold*` utility classes; the values are the blue brand palette.
        brand: {
          dark: "#0B1E3B", // deep navy — sidebar / headers
          gold: "#2563EB", // primary accent, CTAs, active states (blue-600)
          "gold-dark": "#1D4ED8", // gradient / hover end (blue-700)
          "gold-soft": "#DBEAFE", // accent tints (badges, chips) (blue-100)
          cream: "#E8F0FB", // page background (light blue)
          // Explicit blue aliases for new code.
          blue: "#2563EB",
          "blue-dark": "#1D4ED8",
          "blue-soft": "#DBEAFE",
          navy: "#0B1E3B",
        },
        // Amazon KDP accent — use ONLY on "Publish to KDP" / Amazon-facing actions.
        kdp: {
          DEFAULT: "#FF9900",
          dark: "#E88B00",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
