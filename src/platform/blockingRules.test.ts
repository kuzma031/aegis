import { describe, expect, it } from 'vitest';
import {
  buildBlockRules,
  buildBlockedPageUrl,
  parseOriginalUrlFromBlocked,
} from './blockingRules';

describe('buildBlockRules', () => {
  it('builds one redirect rule per site with the original URL in the hash', () => {
    const rules = buildBlockRules(['reddit.com', 'youtube.com'], 'ext-id');
    expect(rules).toEqual([
      {
        id: 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: 'chrome-extension://ext-id/blocked.html#\\0',
          },
        },
        condition: {
          requestDomains: ['reddit.com'],
          resourceTypes: ['main_frame'],
          regexFilter: '^https?://.*$',
        },
      },
      {
        id: 2,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: 'chrome-extension://ext-id/blocked.html#\\0',
          },
        },
        condition: {
          requestDomains: ['youtube.com'],
          resourceTypes: ['main_frame'],
          regexFilter: '^https?://.*$',
        },
      },
    ]);
  });

  it('returns an empty rule set when there are no sites', () => {
    expect(buildBlockRules([], 'ext-id')).toEqual([]);
  });
});

describe('blocked page URL helpers', () => {
  it('round-trips an encoded original URL', () => {
    const original = 'https://old.reddit.com/r/all';
    const blocked = buildBlockedPageUrl('abc', original);
    expect(blocked).toBe(
      `chrome-extension://abc/blocked.html#${encodeURIComponent(original)}`,
    );
    expect(parseOriginalUrlFromBlocked(blocked)).toBe(original);
  });

  it('parses a raw hash URL from DNR regexSubstitution', () => {
    const original = 'https://www.youtube.com/watch?v=1';
    const blocked = `chrome-extension://abc/blocked.html#${original}`;
    expect(parseOriginalUrlFromBlocked(blocked)).toBe(original);
  });

  it('rejects non-http originals', () => {
    expect(
      parseOriginalUrlFromBlocked('chrome-extension://abc/blocked.html#chrome://settings'),
    ).toBeNull();
  });
});
