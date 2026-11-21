import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/components/**/*.{ts,tsx}", "./src/app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warna utama diambil dari src/config/event.ts (lihat src/app/layout.tsx)
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-fg": "rgb(var(--primary-fg) / <alpha-value>)",
        ink: "#000000",
        panel: "rgb(255 255 255 / 0.06)",
        // Garis tipis transparan agar menyatu dengan panel kaca.
        line: "rgb(255 255 255 / 0.1)",
        paper: "#fbf5e6",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
