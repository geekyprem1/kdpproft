import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── KDP Mafia brand ──
        brand: {
          dark: "#0A0A0A", // sidebar / headers
          gold: "#C9A84C", // primary accent, CTAs, active states
          "gold-dark": "#B8973F", // gradient / hover end
          "gold-soft": "#F3EBD3", // gold tints (badges, chips)
          cream: "#FBF7EE", // page background
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
