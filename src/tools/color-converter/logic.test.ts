import { describe, expect, it } from 'vitest';

import { parseColor, rgbToHex, rgbToOklch } from '@/lib/color';
import {
  PALETTE_KINDS,
  PALETTE_STEPS,
  buildPalette,
  paletteToCss,
} from '@/tools/color-converter/logic';

const BASE = parseColor('#4682b4');
if (!BASE) throw new Error('expected the base colour to parse');

describe('tints and shades', () => {
  it('produce the requested number of steps', () => {
    expect(buildPalette(BASE, 'tints')).toHaveLength(PALETTE_STEPS);
    expect(buildPalette(BASE, 'shades', 3)).toHaveLength(3);
  });

  it('get lighter and darker in order', () => {
    const tints = buildPalette(BASE, 'tints').map((entry) => rgbToOklch(entry.rgb).l);
    const shades = buildPalette(BASE, 'shades').map((entry) => rgbToOklch(entry.rgb).l);

    expect([...tints].sort((a, b) => a - b)).toEqual(tints);
    expect([...shades].sort((a, b) => b - a)).toEqual(shades);
  });

  it('stay lighter and darker than the colour they came from', () => {
    const base = rgbToOklch(BASE).l;

    for (const entry of buildPalette(BASE, 'tints')) {
      expect(rgbToOklch(entry.rgb).l).toBeGreaterThan(base);
    }
    for (const entry of buildPalette(BASE, 'shades')) {
      expect(rgbToOklch(entry.rgb).l).toBeLessThan(base);
    }
  });

  it('keep the hue while changing lightness', () => {
    const base = rgbToOklch(BASE);
    for (const entry of buildPalette(BASE, 'tints')) {
      expect(Math.abs(rgbToOklch(entry.rgb).h - base.h)).toBeLessThan(5);
    }
  });
});

describe('harmonies', () => {
  it('puts the complement opposite on the hue wheel', () => {
    const [first, second] = buildPalette(BASE, 'complementary');
    const difference = Math.abs(
      rgbToOklch(second.rgb).h - rgbToOklch(first.rgb).h,
    );

    expect(Math.min(difference, 360 - difference)).toBeCloseTo(180, 0);
  });

  it('puts the analogous pair either side of the base', () => {
    const swatches = buildPalette(BASE, 'analogous');
    expect(swatches).toHaveLength(3);
    expect(swatches[1].hex).toBe(rgbToHex(BASE));
  });

  it('spaces the triad evenly', () => {
    const hues = buildPalette(BASE, 'triadic').map((entry) => rgbToOklch(entry.rgb).h);
    const gaps = [
      Math.abs(hues[1] - hues[0]),
      Math.abs(hues[2] - hues[1]),
    ].map((gap) => Math.min(gap, 360 - gap));

    for (const gap of gaps) expect(gap).toBeCloseTo(120, 0);
  });

  it('always includes the colour it started from', () => {
    for (const kind of ['complementary', 'analogous', 'triadic'] as const) {
      const hexes = buildPalette(BASE, kind).map((entry) => entry.hex);
      expect(hexes).toContain(rgbToHex(BASE));
    }
  });
});

describe('every palette kind', () => {
  it('returns usable swatches', () => {
    for (const kind of PALETTE_KINDS) {
      const swatches = buildPalette(BASE, kind);
      expect(swatches.length).toBeGreaterThan(0);

      for (const entry of swatches) {
        expect(entry.hex).toMatch(/^#[0-9a-f]{6}$/);
        expect(entry.rgb.r).toBeGreaterThanOrEqual(0);
        expect(entry.rgb.r).toBeLessThanOrEqual(255);
      }
    }
  });

  it('handles a colour with no chroma', () => {
    const grey = parseColor('#808080');
    if (!grey) throw new Error('expected grey to parse');

    for (const kind of PALETTE_KINDS) {
      expect(buildPalette(grey, kind).length).toBeGreaterThan(0);
    }
  });

  it('handles black and white without producing nonsense', () => {
    for (const raw of ['#000000', '#ffffff']) {
      const colour = parseColor(raw);
      if (!colour) throw new Error(`expected ${raw} to parse`);

      for (const entry of buildPalette(colour, 'tints')) {
        expect(entry.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe('paletteToCss', () => {
  it('writes numbered custom properties', () => {
    const css = paletteToCss(buildPalette(BASE, 'tints', 2), 'brand');
    const lines = css.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^ {2}--brand-1: #[0-9a-f]{6};$/);
    expect(lines[1]).toMatch(/^ {2}--brand-2: #[0-9a-f]{6};$/);
  });

  it('writes nothing for an empty palette', () => {
    expect(paletteToCss([], 'brand')).toBe('');
  });
});
