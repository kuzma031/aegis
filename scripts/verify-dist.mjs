import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const required = [
  'manifest.json',
  'background.js',
  'popup.html',
  'blocked.html',
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

for (const htmlFile of ['popup.html', 'blocked.html']) {
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

console.log('[verify-dist] ok');
