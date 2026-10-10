import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
const logoPath = join(iconsDir, 'logo.svg');
mkdirSync(iconsDir, { recursive: true });

const SIZES = [16, 32, 48, 128];
const svg = readFileSync(logoPath);

for (const size of SIZES) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  const file = join(iconsDir, `icon${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file}`);
}
