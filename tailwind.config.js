/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "ps-navy": "#1e3a8a",
        "ps-dark": "#0f2847",
        "ps-red": "#dc2626",
        "ps-surface": "#f9fafc",
        "ps-gray": {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
      },
      fontFamily: {
        sans: ["var(--font-source-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-libre-baskerville)", "Georgia", "serif"],
      },
      fontSize: {
        "ps-h1": ["2.5rem", { lineHeight: "1.6", fontWeight: "700" }],
        "ps-h2": ["1.8rem", { lineHeight: "1.6", fontWeight: "700" }],
      },
      boxShadow: {
        card: "0 2px 4px rgb(15 40 71 / 0.08), 0 4px 12px rgb(15 40 71 / 0.1)",
        "card-hover":
          "0 4px 8px rgb(15 40 71 / 0.12), 0 8px 20px rgb(15 40 71 / 0.12)",
        btn: "0 2px 4px rgb(30 58 138 / 0.2)",
        "nav-active": "0 0 0 1px rgb(255 255 255 / 0.12), 0 0 16px rgb(59 130 246 / 0.35)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      transitionTimingFunction: {
        DEFAULT: "ease",
      },
    },
  },
  plugins: [],
};
