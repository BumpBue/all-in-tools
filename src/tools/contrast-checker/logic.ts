import {
  clampChromaToSrgb,
  contrastRatio,
  oklchToRgb,
  parseColor,
  rgbToHex,
  rgbToOklch,
  type Rgb,
} from '@/lib/color';

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
export const AAA_NORMAL = 7;
export const AAA_LARGE = 4.5;

/** APCA-W3 constants, from the published algorithm. */
const TRC = 2.4;
const RED_COEFFICIENT = 0.2126729;
const GREEN_COEFFICIENT = 0.7151522;
const BLUE_COEFFICIENT = 0.072175;
const NORM_BG = 0.56;
const NORM_TEXT = 0.57;
const REVERSE_TEXT = 0.62;
const REVERSE_BG = 0.65;
const BLACK_THRESHOLD = 0.022;
const BLACK_CLAMP = 1.414;
const SCALE = 1.14;
const LOW_OFFSET = 0.027;
const LOW_CLIP = 0.1;
const MIN_DELTA_Y = 0.0005;
const LC_SCALE = 100;

const MAX_CHANNEL = 255;
const LC_PLACES = 1;

const SEARCH_STEPS = 200;
const CSS_VARIABLE = /--([\w-]+)\s*:\s*([^;]+);?/g;

export interface ContrastResult {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

export function checkContrast(foreground: Rgb, background: Rgb): ContrastResult {
  const ratio = contrastRatio(foreground, background);

  return {
    ratio,
    aaNormal: ratio >= AA_NORMAL,
    aaLarge: ratio >= AA_LARGE,
    aaaNormal: ratio >= AAA_NORMAL,
    aaaLarge: ratio >= AAA_LARGE,
  };
}

function apcaLuminance(rgb: Rgb): number {
  const channel = (value: number) => (value / MAX_CHANNEL) ** TRC;
  const y =
    RED_COEFFICIENT * channel(rgb.r) +
    GREEN_COEFFICIENT * channel(rgb.g) +
    BLUE_COEFFICIENT * channel(rgb.b);

  // Soft clamp near black, where the eye stops distinguishing steps.
  return y < BLACK_THRESHOLD ? y + (BLACK_THRESHOLD - y) ** BLACK_CLAMP : y;
}

/**
 * APCA Lc, which weights polarity: light text on a dark background needs
 * different numbers from dark text on a light one. WCAG 2.x treats the pair
 * symmetrically, which is why it misjudges dark themes.
 */
export function apcaContrast(text: Rgb, background: Rgb): number {
  const textY = apcaLuminance(text);
  const backgroundY = apcaLuminance(background);

  if (Math.abs(backgroundY - textY) < MIN_DELTA_Y) return 0;

  if (backgroundY > textY) {
    const sapc = (backgroundY ** NORM_BG - textY ** NORM_TEXT) * SCALE;
    const lc = sapc < LOW_CLIP ? 0 : sapc - LOW_OFFSET;
    return Math.round(lc * LC_SCALE * 10 ** LC_PLACES) / 10 ** LC_PLACES;
  }

  const sapc = (backgroundY ** REVERSE_BG - textY ** REVERSE_TEXT) * SCALE;
  const lc = sapc > -LOW_CLIP ? 0 : sapc + LOW_OFFSET;
  return Math.round(lc * LC_SCALE * 10 ** LC_PLACES) / 10 ** LC_PLACES;
}

export type ApcaUse = 'none' | 'large' | 'body' | 'any';

/** What the published APCA guidance allows at a given Lc. */
export function apcaUse(lc: number): ApcaUse {
  const magnitude = Math.abs(lc);
  if (magnitude >= 75) return 'any';
  if (magnitude >= 60) return 'body';
  if (magnitude >= 45) return 'large';
  return 'none';
}

/**
 * The nearest colour to the original that still reaches the target ratio,
 * found by moving lightness in OKLCH so hue and chroma survive.
 */
export function nearestPassing(
  foreground: Rgb,
  background: Rgb,
  target: number = AA_NORMAL,
): Rgb | null {
  if (contrastRatio(foreground, background) >= target) return foreground;

  const base = rgbToOklch(foreground);

  for (let step = 1; step <= SEARCH_STEPS; step += 1) {
    const distance = step / SEARCH_STEPS;

    for (const lightness of [base.l - distance, base.l + distance]) {
      if (lightness < 0 || lightness > 1) continue;

      const candidate = oklchToRgb(clampChromaToSrgb({ ...base, l: lightness }));
      if (contrastRatio(candidate, background) >= target) return candidate;
    }
  }

  return null;
}

export interface NamedColor {
  name: string;
  value: string;
  rgb: Rgb;
}

/** Reads a block of CSS custom properties so a whole set can be checked. */
export function parseColorList(raw: string): NamedColor[] {
  const found: NamedColor[] = [];

  for (const match of raw.matchAll(CSS_VARIABLE)) {
    const [, name, value] = match;
    const rgb = parseColor(value.trim());
    if (rgb) found.push({ name, value: rgbToHex(rgb), rgb });
  }

  if (found.length > 0) return found;

  // Not custom properties: fall back to one colour per line.
  return raw
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const rgb = parseColor(line);
      return rgb ? [{ name: line, value: rgbToHex(rgb), rgb }] : [];
    });
}
