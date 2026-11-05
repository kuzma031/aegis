import { describe, expect, it } from 'vitest';
import { extractSiteFromUrl, isBlocked, normalizeSite } from './domain';

describe('normalizeSite', () => {
  it('normalizes pasteable URLs and hosts', () => {
    expect(normalizeSite('https://www.Reddit.com/r/foo?x=1')).toEqual({
      ok: true,
      value: 'reddit.com',
    });
    expect(normalizeSite('Reddit.com')).toEqual({ ok: true, value: 'reddit.com' });
    expect(normalizeSite('  WWW.Example.COM:8080/path  ')).toEqual({
      ok: true,
      value: 'example.com',
    });
  });

  it('accepts IDN hostnames via punycode', () => {
    const result = normalizeSite('https://münchen.de');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('xn--mnchen-3ya.de');
  });

  it('rejects empty and invalid input', () => {
    expect(normalizeSite('').ok).toBe(false);
    expect(normalizeSite('localhost').ok).toBe(false);
    expect(normalizeSite('not a site').ok).toBe(false);
    expect(normalizeSite('ftp://example.com').ok).toBe(false);
  });
});

describe('extractSiteFromUrl', () => {
  it('extracts http(s) sites and ignores other schemes', () => {
    expect(extractSiteFromUrl('https://www.reddit.com/r/all')).toBe('reddit.com');
    expect(extractSiteFromUrl('http://old.reddit.com')).toBe('old.reddit.com');
    expect(extractSiteFromUrl('chrome://extensions')).toBeNull();
    expect(extractSiteFromUrl('chrome-extension://abc/popup.html')).toBeNull();
  });
});

describe('isBlocked', () => {
  const sites = ['reddit.com', 'youtube.com'];

  it('matches exact hosts and subdomains', () => {
    expect(isBlocked('https://reddit.com/', sites)).toEqual({
      blocked: true,
      matchedSite: 'reddit.com',
    });
    expect(isBlocked('https://www.reddit.com/r/foo', sites)).toEqual({
      blocked: true,
      matchedSite: 'reddit.com',
    });
    expect(isBlocked('https://old.reddit.com', sites)).toEqual({
      blocked: true,
      matchedSite: 'reddit.com',
    });
  });

  it('does not match lookalike domains', () => {
    expect(isBlocked('https://notreddit.com', sites)).toEqual({ blocked: false });
    expect(isBlocked('https://reddit.com.evil.test', sites)).toEqual({ blocked: false });
  });

  it('ignores non-http URLs', () => {
    expect(isBlocked('chrome://settings', sites)).toEqual({ blocked: false });
  });
});
