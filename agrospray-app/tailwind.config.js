/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f4f6f3",
        card: "#ffffff",
        line: "#e7eae3",
        ink: "#1b211b",
        mut: "#8b958a",
        brand: { DEFAULT: "#2f9e63", dark: "#1f7a4d", bg: "#eaf6ef" },
        coral: { DEFAULT: "#e8654f", dark: "#c84a35", bg: "#fdeee9" },
        orange: { DEFAULT: "#ef8a3c", bg: "#fbe9da" },
        sky: "#5b8def",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: { xl2: "16px" },
      boxShadow: { soft: "0 1px 2px rgba(20,30,20,.04)", float: "0 4px 16px rgba(20,30,20,.08)" },
    },
  },
  plugins: [],
};
