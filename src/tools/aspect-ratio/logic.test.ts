import { describe, expect, it } from 'vitest';

import {
  MAX_DIMENSION,
  PRESETS,
  formatRatio,
  greatestCommonDivisor,
  heightFor,
  parseDimension,
  parseRatio,
  roundingDrift,
  simplifyRatio,
  widthFor,
} from '@/tools/aspect-ratio/logic';

const SIXTEEN_NINE = { width: 16, height: 9 };

describe('greatestCommonDivisor', () => {
  it('reduces a pair', () => {
    expect(greatestCommonDivisor(1920, 1080)).toBe(120);
    expect(greatestCommonDivisor(12, 8)).toBe(4);
  });

  it('is the larger number when one divides the other', () => {
    expect(greatestCommonDivisor(100, 25)).toBe(25);
  });

  it('is one for coprime numbers', () => {
    expect(greatestCommonDivisor(17, 5)).toBe(1);
  });

  it('ignores order and sign', () => {
    expect(greatestCommonDivisor(8, 12)).toBe(4);
    expect(greatestCommonDivisor(-8, 12)).toBe(4);
  });
});

describe('simplifyRatio', () => {
  it('reduces common screen sizes', () => {
    expect(simplifyRatio(1920, 1080)).toEqual(SIXTEEN_NINE);
    expect(simplifyRatio(1280, 720)).toEqual(SIXTEEN_NINE);
    expect(simplifyRatio(1080, 1080)).toEqual({ width: 1, height: 1 });
  });

  it('leaves a ratio that cannot be reduced', () => {
    expect(simplifyRatio(1200, 630)).toEqual({ width: 40, height: 21 });
  });

  it('refuses values outside the usable range', () => {
    expect(simplifyRatio(0, 100)).toBeNull();
    expect(simplifyRatio(100, -5)).toBeNull();
    expect(simplifyRatio(Number.NaN, 100)).toBeNull();
    expect(simplifyRatio(MAX_DIMENSION + 1, 100)).toBeNull();
  });
});

describe('solving for the other side', () => {
  it('finds the height for a width', () => {
    expect(heightFor(1920, SIXTEEN_NINE)).toBe(1080);
  });

  it('finds the width for a height', () => {
    expect(widthFor(1080, SIXTEEN_NINE)).toBe(1920);
  });

  it('returns the unrounded value', () => {
    expect(heightFor(1000, SIXTEEN_NINE)).toBeCloseTo(562.5, 5);
  });

  it('round-trips', () => {
    expect(widthFor(heightFor(1920, SIXTEEN_NINE), SIXTEEN_NINE)).toBe(1920);
  });
});

describe('roundingDrift', () => {
  it('reports an exact fit', () => {
    const drift = roundingDrift(1920, 1080, SIXTEEN_NINE);
    expect(drift.exact).toBe(true);
    expect(drift.driftPercent).toBe(0);
    expect(drift.actual).toEqual(SIXTEEN_NINE);
  });

  it('reports the drift when whole pixels cannot hit the ratio', () => {
    const height = Math.round(heightFor(1000, SIXTEEN_NINE));
    const drift = roundingDrift(1000, height, SIXTEEN_NINE);

    expect(height).toBe(563);
    expect(drift.exact).toBe(false);
    expect(drift.driftPercent).toBeGreaterThan(0);
    expect(drift.driftPercent).toBeLessThan(1);
  });

  it('names the ratio the rounded numbers actually make', () => {
    expect(roundingDrift(1000, 563, SIXTEEN_NINE).actual).toEqual({
      width: 1000,
      height: 563,
    });
  });

  it('gives up on values it cannot use', () => {
    expect(roundingDrift(0, 100, SIXTEEN_NINE).actual).toBeNull();
  });
});

describe('formatRatio', () => {
  it('writes a ratio with a colon', () => {
    expect(formatRatio(SIXTEEN_NINE)).toBe('16:9');
  });

  it('writes nothing for no ratio', () => {
    expect(formatRatio(null)).toBe('');
  });
});

describe('parseDimension', () => {
  it('reads a plain number', () => {
    expect(parseDimension('1920')).toBe(1920);
  });

  it('accepts a thousands separator', () => {
    expect(parseDimension('1,920')).toBe(1920);
  });

  it('accepts a decimal', () => {
    expect(parseDimension('562.5')).toBe(562.5);
  });

  it('refuses what it cannot use', () => {
    expect(parseDimension('')).toBeNull();
    expect(parseDimension('abc')).toBeNull();
    expect(parseDimension('0')).toBeNull();
    expect(parseDimension('-10')).toBeNull();
  });
});

describe('presets', () => {
  it('has a unique id for each', () => {
    const ids = PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names every preset in both languages', () => {
    for (const preset of PRESETS) {
      expect(preset.name.th.length).toBeGreaterThan(0);
      expect(preset.name.en.length).toBeGreaterThan(0);
    }
  });

  it('gives every social preset a pixel size', () => {
    for (const preset of PRESETS.filter((entry) => entry.group === 'social')) {
      expect(preset.pixels).toBeDefined();
    }
  });

  it('keeps each pixel size on its stated ratio', () => {
    for (const preset of PRESETS) {
      if (!preset.pixels) continue;
      expect(
        roundingDrift(preset.pixels.width, preset.pixels.height, preset).exact,
      ).toBe(true);
    }
  });

  it('offers the six common ratios', () => {
    const common = PRESETS.filter((preset) => preset.group === 'common');
    expect(common.map((preset) => formatRatio(preset))).toEqual([
      '16:9',
      '4:3',
      '1:1',
      '9:16',
      '3:2',
      '21:9',
    ]);
  });
});

describe('parseRatio', () => {
  it('reads the common separators', () => {
    expect(parseRatio('16:9')).toEqual(SIXTEEN_NINE);
    expect(parseRatio('16/9')).toEqual(SIXTEEN_NINE);
    expect(parseRatio('16x9')).toEqual(SIXTEEN_NINE);
    expect(parseRatio('16 × 9')).toEqual(SIXTEEN_NINE);
  });

  it('accepts decimals', () => {
    expect(parseRatio('1.85:1')).toEqual({ width: 1.85, height: 1 });
  });

  it('refuses what is not a ratio', () => {
    expect(parseRatio('')).toBeNull();
    expect(parseRatio('16')).toBeNull();
    expect(parseRatio('16:0')).toBeNull();
    expect(parseRatio('abc:def')).toBeNull();
  });
});

describe('drift against a target ratio', () => {
  it('is exact when the numbers sit on the target', () => {
    expect(roundingDrift(1920, 1080, SIXTEEN_NINE).exact).toBe(true);
  });

  // The point of the feature: whole pixels that cannot land on 16:9.
  it('reports drift when whole pixels miss the target', () => {
    const drift = roundingDrift(1000, 563, SIXTEEN_NINE);
    expect(drift.exact).toBe(false);
    expect(drift.driftPercent).toBeGreaterThan(0);
  });

  it('is exact against the ratio the numbers themselves make', () => {
    expect(roundingDrift(1000, 563, { width: 1000, height: 563 }).exact).toBe(true);
  });
});
