import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SHADOW,
  GRADIENT_KINDS,
  GRADIENT_PRESETS,
  MAX_LAYERS,
  MAX_STOPS,
  SHADOW_PRESETS,
  clampAlpha,
  clampAngle,
  clampPercent,
  decodeGradient,
  decodeLayers,
  encodeGradient,
  encodeLayers,
  formatGradient,
  formatLayer,
  formatRgba,
  formatShadow,
  gradientCss,
  shadowCss,
  toArbitrary,
  type Gradient,
  type ShadowLayer,
} from '@/tools/css-generator/logic';

function layer(overrides: Partial<ShadowLayer> = {}): ShadowLayer {
  return { id: 'a', ...DEFAULT_SHADOW, ...overrides };
}

const GRADIENT: Gradient = {
  kind: 'linear',
  angle: 90,
  stops: [
    { id: 'a', color: '#ff0000', position: 0 },
    { id: 'b', color: '#0000ff', position: 100 },
  ],
};

describe('formatRgba', () => {
  it('writes a plain hex when the colour is opaque', () => {
    expect(formatRgba('#ff0000', 1)).toBe('#ff0000');
  });

  it('writes rgba when it is not', () => {
    expect(formatRgba('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
  });

  it('writes no space after a comma, which Tailwind would have to escape', () => {
    expect(formatRgba('#000000', 0.2)).not.toContain(' ');
  });

  it('falls back to black rather than emitting a broken colour', () => {
    expect(formatRgba('not a colour', 0.5)).toBe('rgba(0,0,0,0.5)');
  });
});

describe('formatLayer', () => {
  it('writes the four lengths in CSS order', () => {
    expect(formatLayer(layer({ x: 1, y: 2, blur: 3, spread: 4, alpha: 1 }))).toBe(
      '1px 2px 3px 4px #000000',
    );
  });

  it('leaves out a spread of zero, which CSS defaults to anyway', () => {
    expect(formatLayer(layer({ spread: 0, alpha: 1 }))).toBe('0px 1px 3px #000000');
  });

  it('keeps a negative spread', () => {
    expect(formatLayer(layer({ spread: -2, alpha: 1 }))).toContain('-2px');
  });

  it('puts inset first, where CSS wants it', () => {
    expect(formatLayer(layer({ inset: true })).startsWith('inset ')).toBe(true);
  });
});

describe('formatShadow', () => {
  it('joins layers with a comma', () => {
    const css = formatShadow([layer({ alpha: 1 }), layer({ id: 'b', y: 8, alpha: 1 })]);
    expect(css.split(', ')).toHaveLength(2);
  });

  it('says none when there are no layers, rather than writing nothing', () => {
    expect(formatShadow([])).toBe('none');
  });

  it('keeps the layers in the order given, since they paint in that order', () => {
    const css = formatShadow([
      layer({ y: 1, alpha: 1 }),
      layer({ id: 'b', y: 99, alpha: 1 }),
    ]);
    expect(css.indexOf('1px')).toBeLessThan(css.indexOf('99px'));
  });

  it('writes a complete declaration', () => {
    expect(shadowCss([layer({ alpha: 1 })])).toBe('box-shadow: 0px 1px 3px #000000;');
  });
});

describe('formatGradient', () => {
  it('writes a linear gradient with its angle', () => {
    expect(formatGradient(GRADIENT)).toBe(
      'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)',
    );
  });

  it('writes a radial gradient without one, since it has no angle', () => {
    const css = formatGradient({ ...GRADIENT, kind: 'radial' });

    expect(css).toContain('radial-gradient(circle at center');
    expect(css).not.toContain('90deg');
  });

  it('writes a conic gradient from its starting angle', () => {
    expect(formatGradient({ ...GRADIENT, kind: 'conic' })).toContain('from 90deg');
  });

  it('sorts the stops, so dragging one past another still reads correctly', () => {
    const css = formatGradient({
      ...GRADIENT,
      stops: [
        { id: 'a', color: '#ff0000', position: 80 },
        { id: 'b', color: '#0000ff', position: 20 },
      ],
    });

    expect(css).toBe('linear-gradient(90deg, #0000ff 20%, #ff0000 80%)');
  });

  it('writes a complete declaration', () => {
    expect(gradientCss(GRADIENT).startsWith('background-image: linear-gradient')).toBe(
      true,
    );
  });
});

describe('toArbitrary', () => {
  it('turns spaces into underscores, which is what Tailwind reads', () => {
    expect(toArbitrary('shadow', '0px 1px 3px #000000')).toBe(
      'shadow-[0px_1px_3px_#000000]',
    );
  });

  it('leaves commas alone but removes the space after them', () => {
    expect(toArbitrary('bg', 'linear-gradient(90deg, #f00 0%, #00f 100%)')).toBe(
      'bg-[linear-gradient(90deg,#f00_0%,#00f_100%)]',
    );
  });

  it('produces a value with no spaces at all', () => {
    const value = toArbitrary('shadow', formatShadow([layer(), layer({ id: 'b' })]));
    expect(value).not.toContain(' ');
  });
});

describe('clamping', () => {
  it('keeps alpha between nothing and one', () => {
    expect(clampAlpha(1.5)).toBe(1);
    expect(clampAlpha(-1)).toBe(0);
    expect(clampAlpha(0.123456)).toBe(0.12);
    expect(clampAlpha(Number.NaN)).toBe(1);
  });

  it('keeps a position inside the track', () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(33.6)).toBe(34);
  });

  it('wraps an angle rather than clamping it', () => {
    expect(clampAngle(370)).toBe(10);
    expect(clampAngle(-90)).toBe(270);
    expect(clampAngle(360)).toBe(0);
  });
});

describe('presets', () => {
  it('every shadow preset produces valid CSS', () => {
    for (const preset of SHADOW_PRESETS) {
      const layers = preset.value.map((each, index) => ({ id: String(index), ...each }));
      expect(formatShadow(layers)).toMatch(/px/);
    }
  });

  it('every gradient preset produces valid CSS with at least two stops', () => {
    for (const preset of GRADIENT_PRESETS) {
      expect(preset.value.stops.length).toBeGreaterThanOrEqual(2);
      const gradient: Gradient = {
        kind: preset.value.kind,
        angle: preset.value.angle,
        stops: preset.value.stops.map((stop, index) => ({ id: String(index), ...stop })),
      };
      expect(formatGradient(gradient)).toContain('gradient(');
    }
  });

  it('covers each kind of gradient at least once', () => {
    const kinds = new Set(GRADIENT_PRESETS.map((preset) => preset.value.kind));
    for (const kind of GRADIENT_KINDS) expect(kinds.has(kind)).toBe(true);
  });
});

describe('the link', () => {
  it('round-trips shadow layers', () => {
    const layers = [layer({ x: 2, spread: -1, inset: true }), layer({ id: 'b', y: 9 })];
    const back = decodeLayers(encodeLayers(layers));

    expect(back).toHaveLength(2);
    expect(back[0]).toMatchObject({ x: 2, spread: -1, inset: true });
    expect(back[1]).toMatchObject({ y: 9, inset: false });
  });

  it('round-trips a gradient', () => {
    const back = decodeGradient(encodeGradient(GRADIENT));

    expect(back?.kind).toBe('linear');
    expect(back?.angle).toBe(90);
    expect(back?.stops.map((stop) => stop.color)).toEqual(['#ff0000', '#0000ff']);
  });

  it('gives every decoded item an id of its own', () => {
    const ids = decodeLayers(encodeLayers([layer(), layer({ id: 'b' })])).map(
      (each) => each.id,
    );
    expect(new Set(ids).size).toBe(2);
  });

  it('writes nothing for an empty stack', () => {
    expect(encodeLayers([])).toBe('');
    expect(decodeLayers('')).toEqual([]);
  });

  it('ignores a link that was tampered with', () => {
    expect(decodeLayers('not json')).toEqual([]);
    expect(decodeLayers('[[1,2]]')).toEqual([]);
    expect(decodeGradient('not json')).toBeNull();
    expect(decodeGradient('["spiral",0,[]]')).toBeNull();
  });

  it('refuses a gradient with too few stops to be one', () => {
    expect(decodeGradient('["linear",90,[["#fff",0]]]')).toBeNull();
  });

  it('replaces a colour it cannot read rather than passing it to CSS', () => {
    const decoded = decodeLayers('[[0,1,3,0,"javascript:alert(1)",0.5,0]]');
    expect(decoded[0]?.color).toBe('#000000');
  });

  it('drops a gradient stop whose colour is not a colour', () => {
    expect(decodeGradient('["linear",90,[["#fff",0],["url(x)",100]]]')).toBeNull();
  });

  it('never decodes more than it will render', () => {
    const many = JSON.stringify(
      Array.from({ length: MAX_LAYERS + 5 }, () => [0, 1, 3, 0, '#000000', 0.2, 0]),
    );
    expect(decodeLayers(many)).toHaveLength(MAX_LAYERS);

    const stops = JSON.stringify([
      'linear',
      90,
      Array.from({ length: MAX_STOPS + 5 }, (_, index) => ['#ffffff', index]),
    ]);
    expect(decodeGradient(stops)?.stops).toHaveLength(MAX_STOPS);
  });
});
