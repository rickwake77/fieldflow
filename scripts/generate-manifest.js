// scripts/generate-manifest.js
//
// Regenerates public/manifest.json from theme.config.js, so the PWA
// manifest's colors and app name stay in sync with tailwind.config.js and
// layout.tsx instead of being hand-typed a third time. Run this whenever
// theme.config.js changes:
//
//   node scripts/generate-manifest.js
//
// public/manifest.json stays a plain static file served exactly as before —
// this only changes where its contents come from, not how they're served
// (switching to Next's dynamic manifest route was considered and skipped
// for now, since this app is already installed to a home screen in
// production and that path has its own PWA-install quirks not worth
// risking for a config refactor).

const fs = require("fs");
const path = require("path");
const theme = require("../theme.config.js");

const manifest = {
  name: `${theme.appName} — Farm Contracting`,
  short_name: theme.shortName,
  description: theme.description,
  start_url: "/",
  display: "standalone",
  background_color: theme.backgroundColor,
  theme_color: theme.themeColor,
  orientation: "any",
  scope: "/",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  ],
};

const outPath = path.join(__dirname, "..", "public", "manifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
