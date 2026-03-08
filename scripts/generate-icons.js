// scripts/generate-icons.js
// Run with: node scripts/generate-icons.js
// Generates PWA icons for FieldFlow

const fs = require("fs");
const path = require("path");

function generateSVG(size) {
  const padding = Math.round(size * 0.15);
  const cornerRadius = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.52);
  const textY = Math.round(size * 0.62);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="#d4901a"/>
  <text x="${size/2}" y="${textY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="800" fill="white">F</text>
</svg>`;
}

const iconsDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// Generate SVG versions (browsers can use these, and they scale perfectly)
fs.writeFileSync(path.join(iconsDir, "icon-192.svg"), generateSVG(192));
fs.writeFileSync(path.join(iconsDir, "icon-512.svg"), generateSVG(512));

// Also save as the favicon
fs.writeFileSync(
  path.join(__dirname, "..", "public", "favicon.svg"),
  generateSVG(32)
);

console.log("✓ Generated icon SVGs in public/icons/");
console.log("✓ Generated favicon.svg");
console.log("");
console.log("NOTE: For production PWA icons, convert these SVGs to PNG:");
console.log("  - You can use https://svgtopng.com or any image editor");
console.log("  - Save as icon-192.png (192x192) and icon-512.png (512x512)");
console.log("  - Place them in public/icons/");
console.log("");
console.log("For now, the SVGs will work in most modern browsers.");
