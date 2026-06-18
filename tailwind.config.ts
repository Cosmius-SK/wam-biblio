import type { Config } from "tailwindcss";

/**
 * Soothing, "living journal" palette — warm paper + dusk tones.
 * Colors are wired to CSS variables (see app/globals.css) so the ambient
 * theme can shift with the time of day without rebuilding Tailwind classes.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        sage: "rgb(var(--sage) / <alpha-value>)",
        lavender: "rgb(var(--lavender) / <alpha-value>)",
        terracotta: "rgb(var(--terracotta) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        hairline: "rgb(var(--hairline) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(var(--ink) / 0.04), 0 8px 30px rgb(var(--ink) / 0.06)",
        lift: "0 2px 6px rgb(var(--ink) / 0.06), 0 18px 50px rgb(var(--ink) / 0.10)",
      },
      borderRadius: {
        xl: "1.1rem",
        "2xl": "1.5rem",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.7", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        breathe: "breathe 5.5s ease-in-out infinite",
        rise: "rise 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
