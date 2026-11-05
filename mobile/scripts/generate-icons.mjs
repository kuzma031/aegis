import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(__dirname, '..', 'assets', 'images');
const logoPath = join(__dirname, '..', '..', 'public', 'icons', 'logo.svg');
mkdirSync(imagesDir, { recursive: true });

const logoInner = readFileSync(logoPath, 'utf8')
  .replace(/<\?xml[^?]+\?>/, '')
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .trim();

function wrapLogo({ size, bg, scale }) {
  const logoSize = Math.round(size * scale);
  const offset = Math.round((size - logoSize) / 2);
  const bgRect = bg
    ? `<rect width="${size}" height="${size}" fill="${bg}"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bgRect}
  <g transform="translate(${offset}, ${offset}) scale(${logoSize / 512})">
    ${logoInner}
  </g>
</svg>`;
}

function writePng(fileName, svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  const file = join(imagesDir, fileName);
  writeFileSync(file, png);
  console.log(`wrote ${file}`);
}

writePng(
  'icon.png',
  wrapLogo({ size: 1024, bg: '#f6f4f1', scale: 0.7 }),
  1024,
);
writePng(
  'adaptive-icon.png',
  wrapLogo({ size: 1024, bg: null, scale: 0.55 }),
  1024,
);
writePng(
  'splash-icon.png',
  wrapLogo({ size: 512, bg: null, scale: 0.7 }),
  512,
);
