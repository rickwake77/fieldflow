// theme.config.js
//
// Single source of truth for FieldFlow's brand colors and app identity.
// tailwind.config.js, src/app/layout.tsx, and public/manifest.json (via
// scripts/generate-manifest.js) all read from this file instead of each
// hardcoding their own copy — the app name and the #245a1e green used to be
// typed independently in three places, with nothing keeping them in sync.
//
// A future ___Flow app for a different trade forks this file: swap the
// values here, run scripts/generate-manifest.js, and the color scheme and
// app identity follow through everywhere that reads this config. It does
// not touch wording like "Field" or "hectares" — that's a separate,
// larger piece of work (see the ___Flow config layer plan).

module.exports = {
  appName: "FieldFlow",
  shortName: "FieldFlow",
  tagline: "Farm Contracting Management",
  description: "Manage jobs, logging, and invoicing for agricultural contracting",

  // Two color ramps, each 50 (lightest) through 900 (darkest) — matches
  // Tailwind's default shade scale so `field-600`, `harvest-200`, etc. keep
  // working exactly as before.
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

  // Browser chrome / PWA install colors — derived from the ramps above so
  // there's one place that says "the brand color is field-700"
  get themeColor() {
    return this.colors.field[700];
  },
  backgroundColor: "#F7F6F3",
};
