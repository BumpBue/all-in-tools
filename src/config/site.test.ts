import { describe, expect, it, vi } from 'vitest';

import { FALLBACK_SITE_URL, SITE_URL, resolveSiteUrl } from '@/config/site';

/**
 * A deploy that forgets NEXT_PUBLIC_SITE_URL should get the wrong canonical
 * host, not a failed build. The first Vercel deploy died in the root layout at
 * `new URL(SITE_URL)` because the variable existed but was empty, and `??`
 * only guards undefined.
 */

/** Everything an environment variable can realistically arrive as. */
const JUNK = [
  undefined,
  '',
  '   ',
  '\n',
  'not a url',
  'toolbox.example.com',
  '//example.com',
  'https://',
  'ftp://example.com',
  'javascript:alert(1)',
  'https://exa mple.com',
  '${VERCEL_URL}',
];

describe('resolveSiteUrl', () => {
  it.each(JUNK)('falls back rather than throwing on %j', (raw) => {
    expect(() => resolveSiteUrl(raw)).not.toThrow();
    expect(resolveSiteUrl(raw)).toBe(FALLBACK_SITE_URL);
  });

  it('always returns something new URL() accepts', () => {
    for (const raw of JUNK) {
      expect(() => new URL(resolveSiteUrl(raw))).not.toThrow();
    }
  });

  it('keeps a host that is actually set', () => {
    expect(resolveSiteUrl('https://toolbox.co.th')).toBe('https://toolbox.co.th');
    expect(resolveSiteUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('ignores the whitespace a copy-paste leaves behind', () => {
    expect(resolveSiteUrl('  https://toolbox.co.th  ')).toBe('https://toolbox.co.th');
  });

  it('drops a trailing slash so callers do not build a double one', () => {
    expect(resolveSiteUrl('https://toolbox.co.th/')).toBe('https://toolbox.co.th');
    expect(resolveSiteUrl('https://toolbox.co.th/base/')).toBe(
      'https://toolbox.co.th/base',
    );
  });

  it('drops a query and hash, which mean nothing for a site origin', () => {
    expect(resolveSiteUrl('https://toolbox.co.th/?a=1#b')).toBe('https://toolbox.co.th');
  });

  it('says why it fell back, so a missing variable is not silent', () => {
    const onFallback = vi.fn();

    resolveSiteUrl('', onFallback);
    expect(onFallback).toHaveBeenCalledOnce();
    expect(onFallback.mock.calls[0]?.[0]).toContain('NEXT_PUBLIC_SITE_URL');

    onFallback.mockClear();
    resolveSiteUrl('nonsense', onFallback);
    expect(onFallback.mock.calls[0]?.[0]).toContain('nonsense');
  });

  it('stays quiet when the variable is fine', () => {
    const onFallback = vi.fn();
    resolveSiteUrl('https://toolbox.co.th', onFallback);

    expect(onFallback).not.toHaveBeenCalled();
  });
});

describe('the SITE_URL this build actually uses', () => {
  it('is a URL, whatever the environment held', () => {
    expect(() => new URL(SITE_URL)).not.toThrow();
    expect(SITE_URL).toMatch(/^https?:\/\//);
  });

  it('carries no trailing slash, so joined paths stay single-slashed', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
    expect(`${SITE_URL}/sitemap.xml`).not.toContain('//sitemap.xml');
  });
});
