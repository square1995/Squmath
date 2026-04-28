import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Yu Gothic"',
          '"Meiryo"',
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
