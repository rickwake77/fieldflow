/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        field: {
          50: "#f0f7ee",
          100: "#dcefd8",
          200: "#b9dfb1",
          300: "#8bc880",
          400: "#5fad52",
          500: "#3d8f31",
          600: "#2d7225",
          700: "#245a1e",
          800: "#1f481c",
          900: "#1a3c19",
        },
        harvest: {
          50: "#fdf8eb",
          100: "#faeec8",
          200: "#f5da8c",
          300: "#efc250",
          400: "#e9aa28",
          500: "#d4901a",
          600: "#b06c13",
          700: "#8d4e13",
          800: "#753f17",
          900: "#643418",
        },
      },
    },
  },
  plugins: [],
};
