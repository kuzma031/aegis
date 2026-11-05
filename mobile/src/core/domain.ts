import { err, ok, type Result } from './types';

const INVALID_SITE = 'Enter a valid website';

function stripLeadingWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}

function isValidHostname(host: string): boolean {
  if (!host || host.includes(' ') || host.startsWith('.') || host.endsWith('.')) {
    return false;
  }
  if (!host.includes('.')) {
    return false;
  }
  const labels = host.split('.');
  return labels.every((label) => label.length > 0);
}

/**
 * Normalize a pasteable site string to a bare hostname.
 * Strips protocol, path, port, query, credentials, and one leading www.
 */
export function normalizeSite(input: string): Result<string> {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return err('Enter a website');
  }

  let hostname: string;
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return err(INVALID_SITE);
    }
    hostname = url.hostname.toLowerCase();
  } catch {
    return err(INVALID_SITE);
  }

  hostname = stripLeadingWww(hostname);
  if (!isValidHostname(hostname)) {
    return err(INVALID_SITE);
  }

  return ok(hostname);
}

/** Returns a normalized site for http(s) URLs, otherwise null. */
export function extractSiteFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
  } catch {
    return null;
  }

  const result = normalizeSite(url);
  return result.ok ? result.value : null;
}

export function isBlocked(
  url: string,
  sites: string[],
): { blocked: boolean; matchedSite?: string } {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { blocked: false };
    }
    host = parsed.hostname.toLowerCase();
  } catch {
    return { blocked: false };
  }

  for (const site of sites) {
    const normalized = site.toLowerCase();
    if (host === normalized || host.endsWith(`.${normalized}`)) {
      return { blocked: true, matchedSite: site };
    }
  }

  return { blocked: false };
}
