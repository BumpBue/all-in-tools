import { describe, expect, it } from 'vitest';

import { contrastRatio, parseColor, rgbToHex } from '@/lib/color';
import {
  AA_NORMAL,
  AAA_NORMAL,
  apcaContrast,
  apcaUse,
  checkContrast,
  nearestPassing,
  parseColorList,
} from '@/tools/contrast-checker/logic';

function at(raw: string) {
  const rgb = parseColor(raw);
  if (!rgb) throw new Error(`expected "${raw}" to parse`);
  return rgb;
}

const WHITE = at('#ffffff');
const BLACK = at('#000000');
const MID_GREY = at('#767676');

describe('checkContrast', () => {
  it('passes every level for black on white', () => {
    expect(checkContrast(BLACK, WHITE)).toMatchObject({
      aaNormal: true,
      aaLarge: true,
      aaaNormal: true,
      aaaLarge: true,
    });
  });

  it('fails every level for a colour on itself', () => {
    expect(checkContrast(WHITE, WHITE)).toMatchObject({
      aaNormal: false,
      aaLarge: false,
      aaaNormal: false,
      aaaLarge: false,
    });
  });

  it('separates large text from normal text', () => {
    // Around 3.5:1 passes AA for large text only.
    const result = checkContrast(at('#949494'), WHITE);
    expect(result.aaLarge).toBe(true);
    expect(result.aaNormal).toBe(false);
  });
});

describe('apcaContrast', () => {
  it('is strongly negative for white text on black', () => {
    expect(apcaContrast(WHITE, BLACK)).toBeLessThan(-90);
  });

  it('is strongly positive for black text on white', () => {
    expect(apcaContrast(BLACK, WHITE)).toBeGreaterThan(90);
  });

  it('is zero when text and background match', () => {
    expect(apcaContrast(WHITE, WHITE)).toBe(0);
    expect(apcaContrast(MID_GREY, MID_GREY)).toBe(0);
  });

  it('changes sign with the polarity', () => {
    const dark = apcaContrast(BLACK, WHITE);
    const light = apcaContrast(WHITE, BLACK);

    expect(Math.sign(dark)).toBe(1);
    expect(Math.sign(light)).toBe(-1);
  });

  // This asymmetry is the reason APCA exists: WCAG scores the pair the same
  // either way round, APCA does not.
  it('does not score a flipped pair identically, unlike WCAG', () => {
    const text = at('#606060');
    const forwards = Math.abs(apcaContrast(text, WHITE));
    const backwards = Math.abs(apcaContrast(WHITE, text));

    expect(contrastRatio(text, WHITE)).toBe(contrastRatio(WHITE, text));
    expect(forwards).not.toBeCloseTo(backwards, 1);
  });
});

describe('apcaUse', () => {
  it('maps Lc onto what it may be used for', () => {
    expect(apcaUse(90)).toBe('any');
    expect(apcaUse(65)).toBe('body');
    expect(apcaUse(50)).toBe('large');
    expect(apcaUse(20)).toBe('none');
  });

  it('reads the magnitude, so polarity does not change the verdict', () => {
    expect(apcaUse(-90)).toBe('any');
    expect(apcaUse(-20)).toBe('none');
  });
});

describe('nearestPassing', () => {
  it('leaves a pair that already passes alone', () => {
    expect(nearestPassing(BLACK, WHITE)).toEqual(BLACK);
  });

  it('finds a colour that reaches AA', () => {
    const failing = at('#bbbbbb');
    const fixed = nearestPassing(failing, WHITE);

    expect(fixed).not.toBeNull();
    expect(contrastRatio(fixed!, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('moves as little as it can', () => {
    const failing = at('#bbbbbb');
    const fixed = nearestPassing(failing, WHITE);
    if (!fixed) throw new Error('expected a fix');

    // Any darker and it would have overshot well past the threshold.
    expect(contrastRatio(fixed, WHITE)).toBeLessThan(AA_NORMAL + 0.6);
  });

  it('keeps the hue recognisable', () => {
    const failing = at('#88bbdd');
    const fixed = nearestPassing(failing, WHITE);
    if (!fixed) throw new Error('expected a fix');

    expect(fixed.b).toBeGreaterThan(fixed.r);
  });

  it('can aim at AAA', () => {
    const fixed = nearestPassing(at('#767676'), WHITE, AAA_NORMAL);
    expect(fixed).not.toBeNull();
    expect(contrastRatio(fixed!, WHITE)).toBeGreaterThanOrEqual(AAA_NORMAL);
  });

  it('gives up rather than lying when nothing works', () => {
    // Nothing reaches 21:1 against mid grey.
    expect(nearestPassing(MID_GREY, MID_GREY, 21)).toBeNull();
  });
});

describe('parseColorList', () => {
  it('reads a block of custom properties', () => {
    const list = parseColorList(`
      --brand: #4682b4;
      --accent: rgb(255 0 0);
      --ignored: 12px;
    `);

    expect(list.map((entry) => entry.name)).toEqual(['brand', 'accent']);
    expect(list[0].value).toBe('#4682b4');
  });

  it('falls back to one colour per line', () => {
    const list = parseColorList('#ffffff\n#000000\nsteelblue');
    expect(list.map((entry) => entry.value)).toEqual([
      '#ffffff',
      '#000000',
      '#4682b4',
    ]);
  });

  it('accepts a comma-separated list', () => {
    expect(parseColorList('#fff, #000')).toHaveLength(2);
  });

  it('skips what is not a colour', () => {
    expect(parseColorList('#ffffff\nnonsense\n#000000')).toHaveLength(2);
  });

  it('returns nothing for empty input', () => {
    expect(parseColorList('')).toEqual([]);
    expect(parseColorList('   ')).toEqual([]);
  });

  it('normalizes each value to hex', () => {
    expect(parseColorList('--x: red;')[0].value).toBe(rgbToHex(at('red')));
  });
});
