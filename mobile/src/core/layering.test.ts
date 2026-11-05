import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(dir)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .map((name) => [name, readFileSync(join(dir, name), 'utf8')] as const);

describe('core layering', () => {
  it('does not import react, chrome, expo, or AsyncStorage', () => {
    expect(sources.length).toBeGreaterThan(0);

    for (const [path, source] of sources) {
      expect(source, path).not.toMatch(/\breact\b/i);
      expect(source, path).not.toMatch(/chrome\./);
      expect(source, path).not.toMatch(/\bexpo[-/]/i);
      expect(source, path).not.toMatch(/\bfrom ['"]expo['"]/);
      expect(source, path).not.toMatch(/AsyncStorage/);
    }
  });
});
