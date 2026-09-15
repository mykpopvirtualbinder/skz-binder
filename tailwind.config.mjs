import { join } from "path";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./scripts/**/*.{js,ts,jsx,tsx,mdx}",
    "./public/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        border: "var(--color-border)",
        background: "var(--bg-main)",
        card: "var(--bg-card)",
        soft: "var(--bg-soft)",
        text: {
          main: "var(--text-main)",
          muted: "var(--text-muted)"
        }
      }
    }
  },
  plugins: [],
};
