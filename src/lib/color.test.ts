import { describe, expect, it } from 'vitest';

import {
  CSS_COLOR_NAMES,
  cmykToRgb,
  formatCmyk,
  formatHsl,
  formatOklch,
  formatRgb,
  hslToRgb,
  hsvToRgb,
  nearestColorName,
  oklchToRgb,
  parseColor,
  relativeLuminance,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
} from '@/lib/color';

const RED = { r: 255, g: 0, b: 0, a: 1 };
const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const MID_BLUE = { r: 70, g: 130, b: 180, a: 1 };

function hexOf(raw: string): string {
  const rgb = parseColor(raw);
  if (!rgb) throw new Error(`expected "${raw}" to parse`);
  return rgbToHex(rgb);
}

describe('parseColor', () => {
  it('reads long and short hex', () => {
    expect(hexOf('#ff0000')).toBe('#ff0000');
    expect(hexOf('#f00')).toBe('#ff0000');
    expect(hexOf('ff0000')).toBe('#ff0000');
  });

  it('reads hex with alpha', () => {
    expect(parseColor('#ff000080')?.a).toBeCloseTo(0.502, 2);
    expect(parseColor('#f008')?.a).toBeCloseTo(0.533, 2);
  });

  it('reads rgb and rgba', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual(RED);
    expect(parseColor('rgba(255, 0, 0, 0.5)')?.a).toBe(0.5);
  });

  it('reads hsl', () => {
    expect(hexOf('hsl(0, 100%, 50%)')).toBe('#ff0000');
    expect(hexOf('hsl(120, 100%, 50%)')).toBe('#00ff00');
  });

  // The coordinates here are red's, rounded to what a person would type, so a
  // channel may land one off.
  it('reads oklch', () => {
    const rgb = parseColor('oklch(62.8% 0.2577 29.2)');
    expect(rgb).not.toBeNull();
    expect(Math.abs((rgb?.r ?? 0) - 255)).toBeLessThanOrEqual(1);
    expect(Math.abs((rgb?.g ?? 0) - 0)).toBeLessThanOrEqual(1);
    expect(Math.abs((rgb?.b ?? 0) - 0)).toBeLessThanOrEqual(1);
  });

  it('round-trips oklch written at full precision', () => {
    const exact = formatOklch(rgbToOklch({ r: 255, g: 0, b: 0, a: 1 }));
    expect(rgbToHex(parseColor(exact)!)).toBe('#ff0000');
  });

  it('reads a named colour', () => {
    expect(hexOf('red')).toBe('#ff0000');
    expect(hexOf('steelblue')).toBe('#4682b4');
  });

  it('refuses what it cannot read', () => {
    expect(parseColor('')).toBeNull();
    expect(parseColor('nonsense')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
    expect(parseColor('rgb(a, b, c)')).toBeNull();
  });

  it('ignores case and surrounding space', () => {
    expect(hexOf('  #FF0000  ')).toBe('#ff0000');
    expect(hexOf('RED')).toBe('#ff0000');
  });
});

describe('hex output', () => {
  it('pads single-digit channels', () => {
    expect(rgbToHex({ r: 1, g: 2, b: 3, a: 1 })).toBe('#010203');
  });

  it('appends alpha only when asked and only when partial', () => {
    expect(rgbToHex({ ...RED, a: 0.5 }, true)).toBe('#ff000080');
    expect(rgbToHex(RED, true)).toBe('#ff0000');
    expect(rgbToHex({ ...RED, a: 0.5 }, false)).toBe('#ff0000');
  });
});

describe('hsl round trip', () => {
  it('matches the known values for primaries', () => {
    expect(rgbToHsl(RED)).toMatchObject({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl(WHITE)).toMatchObject({ s: 0, l: 100 });
    expect(rgbToHsl(BLACK)).toMatchObject({ s: 0, l: 0 });
  });

  it('returns to where it started', () => {
    for (const colour of [RED, WHITE, BLACK, MID_BLUE]) {
      expect(hslToRgb(rgbToHsl(colour))).toEqual(colour);
    }
  });

  it('keeps hue at zero for greys', () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 }).h).toBe(0);
  });
});

describe('hsv round trip', () => {
  it('matches the known values for red', () => {
    expect(rgbToHsv(RED)).toMatchObject({ h: 0, s: 100, v: 100 });
  });

  it('returns to where it started', () => {
    for (const colour of [RED, WHITE, BLACK, MID_BLUE]) {
      const back = hsvToRgb(rgbToHsv(colour));
      expect(Math.abs(back.r - colour.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - colour.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - colour.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('cmyk round trip', () => {
  it('matches the known values', () => {
    expect(rgbToCmyk(RED)).toEqual({ c: 0, m: 100, y: 100, k: 0 });
    expect(rgbToCmyk(BLACK)).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(rgbToCmyk(WHITE)).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  it('returns to where it started', () => {
    for (const colour of [RED, WHITE, BLACK, MID_BLUE]) {
      expect(cmykToRgb(rgbToCmyk(colour))).toMatchObject({
        r: colour.r,
        g: colour.g,
        b: colour.b,
      });
    }
  });
});

describe('oklch', () => {
  it('puts white and black at the ends of lightness', () => {
    expect(rgbToOklch(WHITE).l).toBeCloseTo(1, 2);
    expect(rgbToOklch(BLACK).l).toBeCloseTo(0, 2);
  });

  it('gives a grey no chroma', () => {
    expect(rgbToOklch({ r: 128, g: 128, b: 128, a: 1 }).c).toBeLessThan(0.001);
  });

  it('returns to where it started', () => {
    for (const colour of [RED, WHITE, BLACK, MID_BLUE]) {
      const back = oklchToRgb(rgbToOklch(colour));
      expect(Math.abs(back.r - colour.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - colour.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - colour.b)).toBeLessThanOrEqual(1);
    }
  });

  it('puts red near the published coordinates', () => {
    const oklch = rgbToOklch(RED);
    expect(oklch.l).toBeCloseTo(0.6279, 2);
    expect(oklch.c).toBeCloseTo(0.2577, 2);
    expect(oklch.h).toBeCloseTo(29.2, 0);
  });
});

describe('relativeLuminance', () => {
  it('is one for white and zero for black', () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 5);
  });

  it('weights green most heavily', () => {
    const green = relativeLuminance({ r: 0, g: 255, b: 0, a: 1 });
    const red = relativeLuminance(RED);
    const blue = relativeLuminance({ r: 0, g: 0, b: 255, a: 1 });

    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe('nearestColorName', () => {
  it('names an exact match', () => {
    expect(nearestColorName(RED)).toBe('red');
    expect(nearestColorName(WHITE)).toBe('white');
  });

  it('names the closest for something in between', () => {
    expect(nearestColorName({ r: 250, g: 5, b: 5, a: 1 })).toBe('red');
  });

  it('only ever returns a real CSS name', () => {
    const name = nearestColorName(MID_BLUE);
    expect(Object.keys(CSS_COLOR_NAMES)).toContain(name);
  });
});

describe('formatting', () => {
  it('writes each notation', () => {
    expect(formatRgb(RED)).toBe('rgb(255, 0, 0)');
    expect(formatRgb({ ...RED, a: 0.5 })).toBe('rgba(255, 0, 0, 0.5)');
    expect(formatHsl(rgbToHsl(RED))).toBe('hsl(0, 100%, 50%)');
    expect(formatCmyk(rgbToCmyk(RED))).toBe('cmyk(0%, 100%, 100%, 0%)');
    expect(formatOklch(rgbToOklch(RED))).toMatch(/^oklch\(/);
  });

  it('round-trips its own output', () => {
    for (const colour of [RED, MID_BLUE]) {
      expect(hexOf(formatRgb(colour))).toBe(rgbToHex(colour));
      expect(hexOf(formatHsl(rgbToHsl(colour)))).toBe(rgbToHex(colour));
    }
  });
});
