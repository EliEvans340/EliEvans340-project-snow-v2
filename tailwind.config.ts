import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Cyan/ice-blue accent palette (snowflake tone)
        ice: {
          50: "#f0feff",
          100: "#e0fcff",
          200: "#baf8ff",
          300: "#7df2ff",
          400: "#38e8ff",
          500: "#0cd5f0",
          600: "#00afc9",
          700: "#008ba3",
          800: "#086f84",
          900: "#0c5c6e",
          950: "#003d4d",
        },
        // Snow-inspired neutrals for dark theme
        snow: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
      },
    },
  },
  plugins: [],
};
export default config;
