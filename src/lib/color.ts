export interface Rgb {
  r: number;
  g: number;
  b: number;
  /** 0-1 */
  a: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
  a: number;
}

export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

const MAX_CHANNEL = 255;
const DEGREES = 360;
const PERCENT = 100;
const HEX_BASE = 16;
const OKLCH_LIGHTNESS_PLACES = 5;
const OKLCH_CHROMA_PLACES = 5;
const OKLCH_HUE_PLACES = 3;
const GREY_CHROMA = 1e-4;
const GAMUT_SLACK = 1e-6;
const GAMUT_SEARCH_STEPS = 24;
const SRGB_LINEAR_CUTOFF = 0.04045;
const SRGB_GAMMA_CUTOFF = 0.0031308;

const HEX_PATTERN = /^#?([0-9a-f]{3,8})$/i;
const FUNCTIONAL = /^(rgba?|hsla?|oklch)\s*\(([^)]*)\)$/i;

/** The CSS named colours, for naming the closest match to a picked colour. */
export const CSS_COLOR_NAMES: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', lime: '#00ff00',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  silver: '#c0c0c0', gray: '#808080', maroon: '#800000', olive: '#808000',
  green: '#008000', purple: '#800080', teal: '#008080', navy: '#000080',
  orange: '#ffa500', pink: '#ffc0cb', brown: '#a52a2a', beige: '#f5f5dc',
  ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa', salmon: '#fa8072',
  gold: '#ffd700', coral: '#ff7f50', crimson: '#dc143c', indigo: '#4b0082',
  violet: '#ee82ee', turquoise: '#40e0d0', tan: '#d2b48c', plum: '#dda0dd',
  orchid: '#da70d6', tomato: '#ff6347', wheat: '#f5deb3', slategray: '#708090',
  steelblue: '#4682b4', skyblue: '#87ceeb', seagreen: '#2e8b57', forestgreen: '#228b22',
  darkgreen: '#006400', midnightblue: '#191970', firebrick: '#b22222', chocolate: '#d2691e',
};

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function round(value: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function toLinear(channel: number): number {
  const value = channel / MAX_CHANNEL;
  return value <= SRGB_LINEAR_CUTOFF
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
  const channel =
    value <= SRGB_GAMMA_CUTOFF ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return clamp(Math.round(channel * MAX_CHANNEL), 0, MAX_CHANNEL);
}

function expandShortHex(hex: string): string {
  return [...hex].map((character) => character + character).join('');
}

export function parseColor(raw: string): Rgb | null {
  const text = raw.trim().toLowerCase();
  if (text.length === 0) return null;

  const named = CSS_COLOR_NAMES[text];
  if (named) return parseColor(named);

  const hexMatch = HEX_PATTERN.exec(text);
  if (hexMatch) {
    const body = hexMatch[1];
    const expanded =
      body.length === 3 || body.length === 4 ? expandShortHex(body) : body;

    if (expanded.length !== 6 && expanded.length !== 8) return null;

    const value = (start: number) =>
      Number.parseInt(expanded.slice(start, start + 2), HEX_BASE);

    return {
      r: value(0),
      g: value(2),
      b: value(4),
      a: expanded.length === 8 ? value(6) / MAX_CHANNEL : 1,
    };
  }

  const functional = FUNCTIONAL.exec(text);
  if (!functional) return null;

  const [, name, body] = functional;
  const parts = body
    .split(/[\s,/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const numberAt = (index: number, scale = 1) => {
    const part = parts[index];
    if (part === undefined) return Number.NaN;
    const value = Number.parseFloat(part);
    return part.endsWith('%') ? (value / PERCENT) * scale : value;
  };

  const alphaAt = (index: number) => {
    const part = parts[index];
    if (part === undefined) return 1;
    const value = Number.parseFloat(part);
    return clamp(part.endsWith('%') ? value / PERCENT : value, 0, 1);
  };

  if (name.startsWith('rgb')) {
    const channels = [0, 1, 2].map((index) => numberAt(index, MAX_CHANNEL));
    if (channels.some(Number.isNaN)) return null;

    return {
      r: clamp(Math.round(channels[0]), 0, MAX_CHANNEL),
      g: clamp(Math.round(channels[1]), 0, MAX_CHANNEL),
      b: clamp(Math.round(channels[2]), 0, MAX_CHANNEL),
      a: alphaAt(3),
    };
  }

  if (name.startsWith('hsl')) {
    const h = numberAt(0);
    const s = Number.parseFloat(parts[1] ?? '');
    const l = Number.parseFloat(parts[2] ?? '');
    if ([h, s, l].some(Number.isNaN)) return null;

    return hslToRgb({ h, s, l, a: alphaAt(3) });
  }

  const l = numberAt(0, 1);
  const c = Number.parseFloat(parts[1] ?? '');
  const h = Number.parseFloat(parts[2] ?? '');
  if ([l, c, h].some(Number.isNaN)) return null;

  return oklchToRgb({ l, c, h, a: alphaAt(3) });
}

export function rgbToHex(rgb: Rgb, withAlpha = false): string {
  const part = (value: number) =>
    clamp(Math.round(value), 0, MAX_CHANNEL).toString(HEX_BASE).padStart(2, '0');

  const base = `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
  return withAlpha && rgb.a < 1 ? `${base}${part(rgb.a * MAX_CHANNEL)}` : base;
}

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / MAX_CHANNEL;
  const g = rgb.g / MAX_CHANNEL;
  const b = rgb.b / MAX_CHANNEL;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += DEGREES;
  }

  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h: round(h, 1), s: round(s * PERCENT, 1), l: round(l * PERCENT, 1), a: rgb.a };
}

export function hslToRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % DEGREES) + DEGREES) % DEGREES;
  const s = clamp(hsl.s, 0, PERCENT) / PERCENT;
  const l = clamp(hsl.l, 0, PERCENT) / PERCENT;

  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = l - chroma / 2;

  const sector = Math.floor(h / 60) % 6;
  const table: ReadonlyArray<readonly [number, number, number]> = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ];

  const [r, g, b] = table[sector];
  return {
    r: Math.round((r + match) * MAX_CHANNEL),
    g: Math.round((g + match) * MAX_CHANNEL),
    b: Math.round((b + match) * MAX_CHANNEL),
    a: hsl.a,
  };
}

export function rgbToHsv(rgb: Rgb): Hsv {
  const r = rgb.r / MAX_CHANNEL;
  const g = rgb.g / MAX_CHANNEL;
  const b = rgb.b / MAX_CHANNEL;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += DEGREES;
  }

  return {
    h: round(h, 1),
    s: round((max === 0 ? 0 : delta / max) * PERCENT, 1),
    v: round(max * PERCENT, 1),
    a: rgb.a,
  };
}

export function hsvToRgb(hsv: Hsv): Rgb {
  const s = clamp(hsv.s, 0, PERCENT) / PERCENT;
  const v = clamp(hsv.v, 0, PERCENT) / PERCENT;
  const l = v * (1 - s / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);

  return hslToRgb({ h: hsv.h, s: sl * PERCENT, l: l * PERCENT, a: hsv.a });
}

export function rgbToCmyk(rgb: Rgb): Cmyk {
  const r = rgb.r / MAX_CHANNEL;
  const g = rgb.g / MAX_CHANNEL;
  const b = rgb.b / MAX_CHANNEL;

  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: PERCENT };

  return {
    c: round(((1 - r - k) / (1 - k)) * PERCENT, 1),
    m: round(((1 - g - k) / (1 - k)) * PERCENT, 1),
    y: round(((1 - b - k) / (1 - k)) * PERCENT, 1),
    k: round(k * PERCENT, 1),
  };
}

export function cmykToRgb(cmyk: Cmyk, alpha = 1): Rgb {
  const c = clamp(cmyk.c, 0, PERCENT) / PERCENT;
  const m = clamp(cmyk.m, 0, PERCENT) / PERCENT;
  const y = clamp(cmyk.y, 0, PERCENT) / PERCENT;
  const k = clamp(cmyk.k, 0, PERCENT) / PERCENT;

  return {
    r: Math.round(MAX_CHANNEL * (1 - c) * (1 - k)),
    g: Math.round(MAX_CHANNEL * (1 - m) * (1 - k)),
    b: Math.round(MAX_CHANNEL * (1 - y) * (1 - k)),
    a: alpha,
  };
}

/** Ottosson's OKLab, which is what makes lightness steps look even. */
export function rgbToOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  const longCone = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mediumCone = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const shortCone = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const lightness =
    0.2104542553 * longCone + 0.793617785 * mediumCone - 0.0040720468 * shortCone;
  const greenRed =
    1.9779984951 * longCone - 2.428592205 * mediumCone + 0.4505937099 * shortCone;
  const blueYellow =
    0.0259040371 * longCone + 0.7827717662 * mediumCone - 0.808675766 * shortCone;

  const chroma = Math.sqrt(greenRed ** 2 + blueYellow ** 2);
  let hue = (Math.atan2(blueYellow, greenRed) * DEGREES) / (2 * Math.PI);
  if (hue < 0) hue += DEGREES;

  return {
    l: round(lightness, OKLCH_LIGHTNESS_PLACES),
    c: round(chroma, OKLCH_CHROMA_PLACES),
    h: round(chroma < GREY_CHROMA ? 0 : hue, OKLCH_HUE_PLACES),
    a: rgb.a,
  };
}

export function oklchToRgb(oklch: Oklch): Rgb {
  const hueRadians = (oklch.h * Math.PI) / (DEGREES / 2);
  const greenRed = oklch.c * Math.cos(hueRadians);
  const blueYellow = oklch.c * Math.sin(hueRadians);

  const longCone = (oklch.l + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3;
  const mediumCone = (oklch.l - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3;
  const shortCone = (oklch.l - 0.0894841775 * greenRed - 1.291485548 * blueYellow) ** 3;

  return {
    r: fromLinear(4.0767416621 * longCone - 3.3077115913 * mediumCone + 0.2309699292 * shortCone),
    g: fromLinear(-1.2684380046 * longCone + 2.6097574011 * mediumCone - 0.3413193965 * shortCone),
    b: fromLinear(-0.0041960863 * longCone - 0.7034186147 * mediumCone + 1.707614701 * shortCone),
    a: oklch.a,
  };
}

/**
 * Whether an OKLCH colour has an sRGB equivalent at all. Outside the gamut,
 * oklchToRgb clips each channel, which drags the hue with it.
 */
export function oklchInSrgb(oklch: Oklch): boolean {
  const hueRadians = (oklch.h * Math.PI) / (DEGREES / 2);
  const greenRed = oklch.c * Math.cos(hueRadians);
  const blueYellow = oklch.c * Math.sin(hueRadians);

  const longCone = (oklch.l + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3;
  const mediumCone = (oklch.l - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3;
  const shortCone = (oklch.l - 0.0894841775 * greenRed - 1.291485548 * blueYellow) ** 3;

  const linear = [
    4.0767416621 * longCone - 3.3077115913 * mediumCone + 0.2309699292 * shortCone,
    -1.2684380046 * longCone + 2.6097574011 * mediumCone - 0.3413193965 * shortCone,
    -0.0041960863 * longCone - 0.7034186147 * mediumCone + 1.707614701 * shortCone,
  ];

  return linear.every((value) => value >= -GAMUT_SLACK && value <= 1 + GAMUT_SLACK);
}

/** The most chroma this lightness and hue can hold inside sRGB. */
export function clampChromaToSrgb(oklch: Oklch): Oklch {
  if (oklchInSrgb(oklch)) return oklch;

  let low = 0;
  let high = oklch.c;

  for (let step = 0; step < GAMUT_SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (oklchInSrgb({ ...oklch, c: middle })) low = middle;
    else high = middle;
  }

  return { ...oklch, c: low };
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
  );
}

const WCAG_OFFSET = 0.05;
const RATIO_PLACES = 2;

/**
 * WCAG 2.x contrast, from 1 (identical) to 21 (black on white). Lives here
 * rather than with the contrast checker because it is the luminance above it
 * plus four lines, and two tools now ask for it.
 */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const [lighter, darker] = first >= second ? [first, second] : [second, first];

  const ratio = (lighter + WCAG_OFFSET) / (darker + WCAG_OFFSET);
  return Math.round(ratio * 10 ** RATIO_PLACES) / 10 ** RATIO_PLACES;
}

export function nearestColorName(rgb: Rgb): string {
  let best = '';
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [name, hex] of Object.entries(CSS_COLOR_NAMES)) {
    const other = parseColor(hex);
    if (!other) continue;

    // Compared in OKLab, where equal distances look equally different.
    const a = rgbToOklch(rgb);
    const b = rgbToOklch(other);
    const distance =
      (a.l - b.l) ** 2 +
      (a.c * Math.cos((a.h * Math.PI) / 180) - b.c * Math.cos((b.h * Math.PI) / 180)) ** 2 +
      (a.c * Math.sin((a.h * Math.PI) / 180) - b.c * Math.sin((b.h * Math.PI) / 180)) ** 2;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }

  return best;
}

export function formatRgb(rgb: Rgb): string {
  return rgb.a < 1
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(rgb.a, 3)})`
    : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function formatHsl(hsl: Hsl): string {
  return hsl.a < 1
    ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${round(hsl.a, 3)})`
    : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

export function formatHsv(hsv: Hsv): string {
  return `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`;
}

/**
 * Carries enough digits that its own output parses back to the same 8-bit
 * colour. Two decimal places on the lightness percentage did not: red came back
 * one off on the red channel.
 */
export function formatOklch(oklch: Oklch): string {
  const lightness = round(oklch.l * PERCENT, OKLCH_LIGHTNESS_PLACES);
  const base = `oklch(${lightness}% ${oklch.c} ${oklch.h})`;
  return oklch.a < 1 ? base.replace(')', ` / ${round(oklch.a, 3)})`) : base;
}

export function formatCmyk(cmyk: Cmyk): string {
  return `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
}
