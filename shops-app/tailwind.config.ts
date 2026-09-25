import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Storefront UI v2 — needed so its utility classes aren't purged
    "./node_modules/@storefront-ui/react/**/*.{js,mjs}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Suqafuran brand ──────────────────────────────────────────────
        primary: "#38BDF8",
        "primary-dark": "#0284C7",
        accent: "#22C55E",
        "neutral-bg": "#F8FAFC",
        "neutral-card": "#FFFFFF",
        // ── Storefront UI v2 primary scale → Suqafuran sky palette ──────
        // SFUI accesses these as bg-primary-500, text-primary-700 etc.
        "primary-50":  "#f0f9ff",
        "primary-100": "#e0f2fe",
        "primary-200": "#bae6fd",
        "primary-300": "#7dd3fc",
        "primary-400": "#38bdf8",
        "primary-500": "#0ea5e9",
        "primary-600": "#0284c7",
        "primary-700": "#0369a1",
        "primary-800": "#075985",
        "primary-900": "#0c4a6e",
        "primary-950": "#082f49",
        // ── SFUI secondary scale → neutral slate ────────────────────────
        "secondary-50":  "#f8fafc",
        "secondary-100": "#f1f5f9",
        "secondary-200": "#e2e8f0",
        "secondary-300": "#cbd5e1",
        "secondary-400": "#94a3b8",
        "secondary-500": "#64748b",
        "secondary-600": "#475569",
        "secondary-700": "#334155",
        "secondary-800": "#1e293b",
        "secondary-900": "#0f172a",
        "secondary-950": "#020617",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        poppins: ["var(--font-poppins)", "sans-serif"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        float: "floatY 3s ease-in-out infinite",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      borderRadius: {
        "xl": "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
