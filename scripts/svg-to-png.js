// scripts/svg-to-png.js
// Simple script to create PNG icons without external dependencies
// Uses a 1x1 pixel placeholder — replace with proper PNGs for production

const fs = require("fs");
const path = require("path");

// Minimal valid PNG generator (creates a solid-color PNG)
function createPNG(width, height, r, g, b) {
  // We'll create a simple HTML file you can open in a browser to download PNGs
  const html = `<!DOCTYPE html>
<html>
<head><title>Generate FieldFlow Icons</title></head>
<body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
  <h1>FieldFlow Icon Generator</h1>
  <p>Click each button to download the icon as PNG.</p>
  
  <div style="margin: 20px 0;">
    <canvas id="c192" width="192" height="192" style="border: 1px solid #ccc; border-radius: 12px;"></canvas>
    <br><button onclick="download('c192', 'icon-192.png')" style="margin-top: 8px; padding: 8px 16px; cursor: pointer;">Download 192x192</button>
  </div>
  
  <div style="margin: 20px 0;">
    <canvas id="c512" width="512" height="512" style="border: 1px solid #ccc; border-radius: 12px; max-width: 256px;"></canvas>
    <br><button onclick="download('c512', 'icon-512.png')" style="margin-top: 8px; padding: 8px 16px; cursor: pointer;">Download 512x512</button>
  </div>

  <script>
    function drawIcon(canvasId, size) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext('2d');
      const r = size * 0.18;
      
      // Rounded rect background
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(size - r, 0);
      ctx.quadraticCurveTo(size, 0, size, r);
      ctx.lineTo(size, size - r);
      ctx.quadraticCurveTo(size, size, size - r, size);
      ctx.lineTo(r, size);
      ctx.quadraticCurveTo(0, size, 0, size - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fillStyle = '#d4901a';
      ctx.fill();
      
      // Letter F
      ctx.fillStyle = 'white';
      ctx.font = 'bold ' + (size * 0.6) + 'px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', size / 2, size / 2 + size * 0.03);
    }
    
    drawIcon('c192', 192);
    drawIcon('c512', 512);
    
    function download(canvasId, filename) {
      const canvas = document.getElementById(canvasId);
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  </script>
</body>
</html>`;

  const outPath = path.join(__dirname, "..", "public", "generate-icons.html");
  fs.writeFileSync(outPath, html);
  console.log("Created: public/generate-icons.html");
  console.log("Open this file in your browser and click the download buttons");
  console.log("Then move the PNGs to public/icons/");
}

createPNG();
