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
          bg: "#040509",
          surface: "#0A0D16",
          elevated: "#101524",
          border: "#1C243B",
          neon: "#00F0FF",
          cyan: "#06B6D4",
          violet: "#8B5CF6",
          fuchsia: "#EC4899",
          emerald: "#10B981",
          amber: "#F59E0B",
          crimson: "#F43F5E",
          text: "#F8FAFC",
          muted: "#8E9BAE",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        "neon-cyan": "0 0 25px rgba(0, 240, 255, 0.28), 0 0 60px rgba(0, 240, 255, 0.08)",
        "neon-cyan-lg": "0 0 35px rgba(0, 240, 255, 0.45), 0 0 90px rgba(0, 240, 255, 0.16)",
        "neon-violet": "0 0 25px rgba(139, 92, 246, 0.32), 0 0 60px rgba(139, 92, 246, 0.1)",
        "neon-emerald": "0 0 25px rgba(16, 185, 129, 0.32), 0 0 60px rgba(16, 185, 129, 0.1)",
        "neon-crimson": "0 0 25px rgba(244, 63, 94, 0.35), 0 0 60px rgba(244, 63, 94, 0.12)",
        "island": "0 20px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.09), 0 0 30px rgba(0, 240, 255, 0.15)",
      },
      backgroundImage: {
        "voam-mesh":
          "radial-gradient(circle at 15% 15%, rgba(0, 240, 255, 0.09) 0%, transparent 45%), radial-gradient(circle at 85% 20%, rgba(139, 92, 246, 0.09) 0%, transparent 45%), radial-gradient(circle at 50% 90%, rgba(6, 182, 212, 0.06) 0%, transparent 50%)",
      },
    },
  },
  plugins: [],
};

export default config;
