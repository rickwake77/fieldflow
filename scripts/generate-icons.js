// scripts/generate-icons.js
//
// Regenerates every home-screen/PWA icon PNG from a single master image, so
// changing public/logo.png and re-running this is enough to update all of
// them together -- including the iOS apple-touch-icon (icon-180.png), which
// is a separate file from the manifest's icon-192/512.png and is easy to
// forget to update by hand.
//
// Run with: node scripts/generate-icons.js  (or: npm run icons)

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SOURCE = path.join(__dirname, "..", "public", "logo.png");
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

const SIZES = [
  { size: 180, file: "icon-180.png" }, // iOS apple-touch-icon, see layout.tsx
  { size: 192, file: "icon-192.png" }, // manifest.json
  { size: 512, file: "icon-512.png" }, // manifest.json
];

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Master icon not found: ${SOURCE}`);
    console.error("Replace public/logo.png with your new icon (square, ideally 512x512+) and re-run.");
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { size, file } of SIZES) {
    const outPath = path.join(OUT_DIR, file);
    await sharp(SOURCE).resize(size, size).png().toFile(outPath);
    console.log(`Wrote public/icons/${file} (${size}x${size})`);
  }

  console.log("");
  console.log("Done. If FieldFlow is already added to an iPhone home screen,");
  console.log("remove it and re-add it -- iOS snapshots the icon at add-time");
  console.log("and won't pick up this change on its own.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
