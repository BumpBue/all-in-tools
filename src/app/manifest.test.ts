import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import manifest from '@/app/manifest';

const PUBLIC_DIR = 'public';

// A browser only offers to install when the manifest holds all of this. The
// failure mode is silent — no error anywhere, just no install prompt — so the
// requirements are pinned here rather than discovered on a phone.
describe('the web app manifest', () => {
  it('carries what an installable app needs', () => {
    const result = manifest();

    expect(result.name).toBeTruthy();
    expect(result.short_name).toBeTruthy();
    expect(result.start_url).toBe('/');
    expect(result.display).toBe('standalone');
    expect(result.theme_color).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.background_color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('offers both icon sizes a browser looks for', () => {
    const sizes = (manifest().icons ?? []).map((icon) => icon.sizes);

    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('offers a maskable icon so the art is not cropped into', () => {
    const maskable = (manifest().icons ?? []).filter(
      (icon) => icon.purpose === 'maskable',
    );

    expect(maskable.length).toBeGreaterThan(0);
  });

  it('points only at icons that exist', () => {
    const referenced = [
      ...(manifest().icons ?? []),
      ...(manifest().shortcuts ?? []).flatMap((shortcut) => shortcut.icons ?? []),
    ].map((icon) => icon.src);

    expect(referenced.length).toBeGreaterThan(0);

    for (const src of referenced) {
      expect(existsSync(`${PUBLIC_DIR}${src}`), `${src} is missing`).toBe(true);
    }
  });

  it('keeps a shortcut name short enough to show', () => {
    for (const shortcut of manifest().shortcuts ?? []) {
      expect(shortcut.short_name?.length ?? 0).toBeGreaterThan(0);
      expect(shortcut.name.length).toBeLessThan(40);
    }
  });
});
