/** Pure DNR rule construction for focus site blocking. */

export interface BlockRule {
  id: number;
  priority: number;
  action: {
    type: 'redirect';
    redirect: {
      regexSubstitution: string;
    };
  };
  condition: {
    requestDomains: string[];
    resourceTypes: Array<'main_frame'>;
    regexFilter: string;
  };
}

export function buildBlockRules(sites: string[], extensionId: string): BlockRule[] {
  return sites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        regexSubstitution: `chrome-extension://${extensionId}/blocked.html#\\0`,
      },
    },
    condition: {
      requestDomains: [site],
      resourceTypes: ['main_frame'],
      regexFilter: '^https?://.*$',
    },
  }));
}

export function buildBlockedPageUrl(extensionId: string, originalUrl: string): string {
  return `chrome-extension://${extensionId}/blocked.html#${encodeURIComponent(originalUrl)}`;
}

export function isExtensionBlockedPageUrl(url: string, extensionId: string): boolean {
  const prefix = `chrome-extension://${extensionId}/blocked.html`;
  return url === prefix || url.startsWith(`${prefix}#`) || url.startsWith(`${prefix}?`);
}

/** Parse the original http(s) URL from a blocked page, accepting raw or encoded hashes. */
export function parseOriginalUrlFromBlocked(blockedPageUrl: string): string | null {
  let hash: string;
  try {
    const parsed = new URL(blockedPageUrl);
    hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  } catch {
    return null;
  }

  if (!hash) {
    return null;
  }

  const candidates = [hash];
  try {
    candidates.unshift(decodeURIComponent(hash));
  } catch {
    // Keep the raw hash only.
  }

  for (const candidate of candidates) {
    try {
      const original = new URL(candidate);
      if (original.protocol === 'http:' || original.protocol === 'https:') {
        return original.href;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}
