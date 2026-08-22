const theme = require("./theme.config.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: theme.colors,
    },
  },
  plugins: [],
};
