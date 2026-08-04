import type { Config } from "tailwindcss";

/**
 * Soothing, "living journal" palette — warm paper + dusk tones.
 * Colors are wired to CSS variables (see app/globals.css) so the ambient
 * theme can shift with the time of day without rebuilding Tailwind classes.
 *
 * The scale below is the book: a typographic rhythm built for reading long
 * serif text, and elevation that behaves like paper (a leaf resting on the
 * stack) rather than like floating UI chrome.
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
      // A reading-first scale: display sizes tighten as they grow, body text
      // stays generous. Paired line-heights keep long serif passages breathing.
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.06em" }],
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.3rem" }],
        base: ["0.9375rem", { lineHeight: "1.55rem" }],
        read: ["1.0625rem", { lineHeight: "1.78rem" }],
        lg: ["1.125rem", { lineHeight: "1.65rem" }],
        xl: ["1.3125rem", { lineHeight: "1.8rem", letterSpacing: "-0.005em" }],
        "2xl": ["1.5rem", { lineHeight: "1.95rem", letterSpacing: "-0.012em" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.018em" }],
        "4xl": ["2.375rem", { lineHeight: "2.6rem", letterSpacing: "-0.022em" }],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(var(--ink) / 0.04), 0 8px 30px rgb(var(--ink) / 0.06)",
        lift: "0 2px 6px rgb(var(--ink) / 0.06), 0 18px 50px rgb(var(--ink) / 0.10)",
        // A leaf of paper resting on the stack: tight contact shadow + spread.
        page: "0 1px 1px rgb(var(--ink) / 0.05), 0 3px 8px rgb(var(--ink) / 0.05), 0 14px 40px rgb(var(--ink) / 0.08)",
        press: "inset 0 1px 3px rgb(var(--ink) / 0.14)",
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
        // Maya, listening and speaking: a slow swell with a brighter crest.
        pulseSoft: {
          "0%, 100%": { opacity: "0.6", transform: "scale(0.97)" },
          "50%": { opacity: "1", transform: "scale(1.06)" },
        },
      },
      animation: {
        breathe: "breathe 5.5s ease-in-out infinite",
        rise: "rise 0.6s ease-out both",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
