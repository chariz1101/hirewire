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
          blue:    "#1847F0",   // primary electric blue
          navy:    "#0A0F2C",   // dark navy (sidebar, headers)
          light:   "#E8EEFF",   // pale blue tint (backgrounds)
          muted:   "#6B7FCC",   // muted blue (secondary text on dark)
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;