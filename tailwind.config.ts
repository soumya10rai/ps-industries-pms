import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#b9dffd",
          300: "#7cc5fb",
          400: "#36a7f6",
          500: "#0c8ce7",
          600: "#006fc5",
          700: "#0158a0",
          800: "#064b84",
          900: "#0b3f6e",
          950: "#072849",
        },
        steel: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae3",
          300: "#b0bac9",
          400: "#8595ab",
          500: "#667891",
          600: "#516077",
          700: "#424e61",
          800: "#394352",
          900: "#333a46",
          950: "#22262f",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
