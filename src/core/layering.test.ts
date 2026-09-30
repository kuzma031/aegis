import { describe, expect, it } from 'vitest';

const sources = import.meta.glob(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('core layering', () => {
  it('does not import react or reference chrome APIs', () => {
    const entries = Object.entries(sources);
    expect(entries.length).toBeGreaterThan(0);

    for (const [path, source] of entries) {
      expect(source, path).not.toMatch(/\breact\b/i);
      expect(source, path).not.toMatch(/chrome\./);
    }
  });
});
