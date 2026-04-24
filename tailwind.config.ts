import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#534AB7",
          dark: "#3C3489",
          light: "#EEEDFE"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"]
      },
      borderRadius: {
        component: "8px",
        card: "12px"
      }
    }
  },
  plugins: []
};

export default config;
