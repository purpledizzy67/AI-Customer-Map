import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#0b0f14",
          raised: "#121821",
          overlay: "#1a2330",
          border: "#2a3544",
        },
        ink: {
          DEFAULT: "#e8eef6",
          muted: "#8b9bb0",
          faint: "#5c6b7e",
        },
        brand: {
          DEFAULT: "#3d9cf0",
          soft: "#1e4a72",
          glow: "#5eb0ff",
        },
        signal: {
          high: "#34d399",
          mid: "#fbbf24",
          low: "#f87171",
          warn: "#fb923c",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.35)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out both",
        "pulse-soft": "pulseSoft 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
