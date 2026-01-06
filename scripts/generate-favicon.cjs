const fs = require("node:fs");
const path = require("node:path");
const Jimp = require("jimp");
const pngToIco = require("png-to-ico");

const sourcePath = path.join(__dirname, "..", "assets", "profile.jpg");
const outputPath = path.join(__dirname, "..", "assets", "favicon.ico");
const sizes = [16, 32, 48, 64, 128, 256];

async function generateFavicon() {
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Profile image not found: ${sourcePath}`);
    return;
  }

  const image = await Jimp.read(sourcePath);
  const pngBuffers = [];

  for (const size of sizes) {
    const buffer = await image
      .clone()
      .cover(size, size)
      .getBufferAsync(Jimp.MIME_PNG);
    pngBuffers.push(buffer);
  }

  const ico = await pngToIco(pngBuffers);
  fs.writeFileSync(outputPath, ico);
}

generateFavicon().catch((error) => {
  console.error("Failed to generate favicon:", error);
  process.exit(1);
});
