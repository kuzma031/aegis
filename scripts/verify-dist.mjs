import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const required = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'blocked.html',
  'sidepanel.html',
  'offscreen.html',
  'offscreen.js',
  'sounds/freesound-bell.mp3',
  'sounds/anvil-bell.mp3',
  'sounds/notify-bell.mp3',
  'sounds/opening-bell.mp3',
  'sounds/ring-bell.mp3',
  'sounds/brown-noise.wav',
  'sounds/cafe-noise.mp3',
  'sounds/lofi-hop.wav',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

const missing = required.filter((rel) => !existsSync(join(dist, rel)));
if (missing.length > 0) {
  console.error('[verify-dist] missing files:', missing.join(', '));
  process.exit(1);
}

for (const htmlFile of ['popup.html', 'blocked.html', 'sidepanel.html']) {
  const html = readFileSync(join(dist, htmlFile), 'utf8');
  if (html.includes('src="/') || html.includes('href="/')) {
    console.error(
      `[verify-dist] ${htmlFile} contains absolute asset URLs; expected relative paths for chrome-extension://`,
    );
    process.exit(1);
  }
  if (!html.includes('./assets/') && !html.includes('assets/')) {
    console.error(`[verify-dist] ${htmlFile} has no assets/ script or stylesheet reference`);
    process.exit(1);
  }
}

const content = readFileSync(join(dist, 'content.js'), 'utf8');
if (content.trim().length < 100) {
  console.error('[verify-dist] content.js looks empty');
  process.exit(1);
}

const offscreenHtml = readFileSync(join(dist, 'offscreen.html'), 'utf8');
if (!offscreenHtml.includes('src="offscreen.js"') && !offscreenHtml.includes("src='offscreen.js'")) {
  console.error('[verify-dist] offscreen.html must load offscreen.js (MV3 blocks inline scripts)');
  process.exit(1);
}
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(offscreenHtml)) {
  console.error('[verify-dist] offscreen.html must not contain inline scripts');
  process.exit(1);
}

console.log('[verify-dist] ok');
