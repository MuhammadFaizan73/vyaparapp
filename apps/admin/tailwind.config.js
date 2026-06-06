/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0f5a72", light: "#1a7a9a", dark: "#0a3d50" },
      },
    },
  },
  plugins: [],
};
