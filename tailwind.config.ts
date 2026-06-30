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
        cream: "#FFF4C7",
        corgi: "#F59E3D",
        skysoft: "#AEE8FF",
        ink: "#2F2A24",
        biscuit: "#FFE2A8"
      },
      boxShadow: {
        glow: "0 20px 60px rgba(245, 158, 61, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
