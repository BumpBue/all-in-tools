import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { oklchToRgb, type Rgb } from '@/lib/color';
import { AA_LARGE, AA_NORMAL, checkContrast } from '@/tools/contrast-checker/logic';

/**
 * The palette is checked with the site's own contrast-checker rather than an
 * outside tool: if the two ever disagreed, the tool the site ships would be the
 * one that was wrong, and this is where that shows up.
 *
 * Tokens are read out of globals.css so the test cannot drift from the real
 * palette the way a hardcoded copy would.
 */
const CSS_PATH = 'src/app/globals.css';

const LIGHT_BLOCK = /:root\s*\{([^}]*)\}/;
const DARK_BLOCK = /\.dark\s*\{([^}]*)\}/;
const TOKEN = /--([\w-]+)\s*:\s*oklch\(([^)]+)\)/g;

type Palette = Record<string, Rgb>;

function readPalette(block: RegExp): Palette {
  const css = readFileSync(CSS_PATH, 'utf8');
  const body = block.exec(css)?.[1];
  if (!body) throw new Error(`no block matching ${block} in ${CSS_PATH}`);

  const palette: Palette = {};

  for (const [, name, values] of body.matchAll(TOKEN)) {
    // Tokens carrying an alpha (the overlay) are layered over something else,
    // so a flat ratio would not describe what a reader actually sees.
    if (values.includes('/')) continue;

    const [lightness, chroma, hue] = values.trim().split(/\s+/).map(Number);
    palette[name] = oklchToRgb({
      l: lightness ?? 0,
      c: chroma ?? 0,
      h: hue ?? 0,
      a: 1,
    });
  }

  return palette;
}

/** Text that must stay readable, as [foreground, background, minimum ratio]. */
const PAIRS: Array<[string, string, number]> = [
  ['foreground', 'background', AA_NORMAL],
  ['foreground', 'surface', AA_NORMAL],
  ['foreground', 'surface-subtle', AA_NORMAL],
  ['foreground', 'accent-subtle', AA_NORMAL],
  ['muted', 'background', AA_NORMAL],
  ['muted', 'surface', AA_NORMAL],
  ['muted', 'surface-subtle', AA_NORMAL],
  ['on-accent', 'accent', AA_NORMAL],
  ['on-danger', 'danger', AA_NORMAL],
  ['accent', 'background', AA_NORMAL],
  ['accent', 'surface', AA_NORMAL],
  ['danger', 'background', AA_NORMAL],
  ['danger', 'surface', AA_NORMAL],
  ['success', 'background', AA_NORMAL],
  ['success', 'surface', AA_NORMAL],
  // A focus ring is a shape, not text, so the large-text bar is the one WCAG
  // applies to it.
  ['ring', 'background', AA_LARGE],
  ['ring', 'surface', AA_LARGE],
];

// --border and --border-strong are deliberately absent. Neither carries
// information on its own: --border outlines a card that is already separated by
// its background, and --border-strong only appears on hover, over a border that
// is visible anyway. Anything that fills a chart or states a value uses a token
// listed above instead.


describe.each([
  ['light', LIGHT_BLOCK],
  ['dark', DARK_BLOCK],
])('the %s palette meets WCAG AA', (_theme, block) => {
  const palette = readPalette(block);

  it.each(PAIRS)('%s on %s', (foreground, background, minimum) => {
    const text = palette[foreground];
    const behind = palette[background];

    expect(text, `--${foreground} is missing`).toBeDefined();
    expect(behind, `--${background} is missing`).toBeDefined();

    const { ratio } = checkContrast(text as Rgb, behind as Rgb);
    expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(minimum);
  });
});
