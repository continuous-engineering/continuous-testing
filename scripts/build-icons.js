/**
 * Build app icons from build/favicon.svg
 * Outputs: build/icon.ico (multi-size), build/icon.png (512px)
 * Run: npm run icon
 */
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const root   = path.join(__dirname, '..');
const svgSrc = path.join(root, 'build', 'favicon.svg');
const icoOut = path.join(root, 'build', 'icon.ico');
const pngOut = path.join(root, 'build', 'icon.png');

if (!fs.existsSync(svgSrc)) {
  console.error('build/favicon.svg not found');
  process.exit(1);
}

(async () => {
  const svg = fs.readFileSync(svgSrc);

  // ICO: 16, 32, 48, 64, 128, 256
  const icoSizes  = [16, 32, 48, 64, 128, 256];
  const pngBufs   = await Promise.all(
    icoSizes.map(s => sharp(svg).resize(s, s).png().toBuffer())
  );
  icoSizes.forEach((s, i) => console.log(`  ${s}x${s}  ${pngBufs[i].length}b`));

  // Assemble ICO binary
  const count      = icoSizes.length;
  const headerSize = 6 + count * 16;
  let offset       = headerSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = icoSizes.map((size, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(pngBufs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngBufs[i].length;
    return e;
  });

  fs.writeFileSync(icoOut, Buffer.concat([header, ...entries, ...pngBufs]));
  console.log(`icon.ico  ${fs.statSync(icoOut).size}b`);

  // PNG 512x512 for macOS/Linux
  const png = await sharp(svg).resize(512, 512).png().toBuffer();
  fs.writeFileSync(pngOut, png);
  console.log(`icon.png  ${png.length}b`);
})().catch(e => { console.error(e); process.exit(1); });
