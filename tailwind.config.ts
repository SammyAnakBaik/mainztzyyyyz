import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        voam: {
          bg: "#050507",
          surface: "#0B0B0F",
          elevated: "#121218",
          border: "#1F1F28",
          neon: "#38BDF8",
          cyan: "#22D3EE",
          violet: "#818CF8",
          fuchsia: "#F472B6",
          emerald: "#34D399",
          amber: "#FBBF24",
          crimson: "#FB7185",
          text: "#FAFAFA",
          muted: "#8E8E99",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        "glass-sm":
          "0 1px 0 0 rgba(255, 255, 255, 0.07) inset, 0 8px 24px -4px rgba(0, 0, 0, 0.6)",
        "glass-lg":
          "0 1px 0 0 rgba(255, 255, 255, 0.09) inset, 0 24px 64px -12px rgba(0, 0, 0, 0.85)",
        island:
          "0 24px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.12) inset",
      },
      backgroundImage: {
        "voam-mesh":
          "radial-gradient(ellipse 80% 45% at 50% -15%, rgba(255, 255, 255, 0.055), rgba(56, 189, 248, 0.025) 45%, transparent 80%)",
      },
    },
  },
  plugins: [],
};

export default config;
