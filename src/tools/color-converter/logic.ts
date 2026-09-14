import {
  clampChromaToSrgb,
  oklchToRgb,
  rgbToHex,
  rgbToOklch,
  type Rgb,
} from '@/lib/color';

export const PALETTE_STEPS = 5;
export const ANALOGOUS_ANGLE = 30;
export const TRIADIC_ANGLE = 120;
export const COMPLEMENT_ANGLE = 180;

const DEGREES = 360;
const LIGHTEST = 0.97;
const DARKEST = 0.08;

export type PaletteKind =
  | 'tints'
  | 'shades'
  | 'complementary'
  | 'analogous'
  | 'triadic';

export const PALETTE_KINDS: readonly PaletteKind[] = [
  'tints',
  'shades',
  'complementary',
  'analogous',
  'triadic',
];

export interface Swatch {
  hex: string;
  rgb: Rgb;
}

function swatch(rgb: Rgb): Swatch {
  return { hex: rgbToHex(rgb), rgb };
}

function rotated(rgb: Rgb, degrees: number): Rgb {
  const oklch = rgbToOklch(rgb);
  const hue = (((oklch.h + degrees) % DEGREES) + DEGREES) % DEGREES;
  return oklchToRgb(clampChromaToSrgb({ ...oklch, h: hue }));
}

/**
 * Lightness steps are taken in OKLCH rather than by mixing with white or black
 * in sRGB, so each step looks like the same size change. Chroma is pulled back
 * to whatever sRGB can hold at that lightness: left alone, a light tint falls
 * outside the gamut and the clipping drags its hue several degrees.
 */
function withLightness(rgb: Rgb, lightness: number): Rgb {
  return oklchToRgb(clampChromaToSrgb({ ...rgbToOklch(rgb), l: lightness }));
}

export function buildPalette(
  rgb: Rgb,
  kind: PaletteKind,
  steps: number = PALETTE_STEPS,
): Swatch[] {
  const base = rgbToOklch(rgb);

  switch (kind) {
    case 'tints': {
      return Array.from({ length: steps }, (_, index) => {
        const ratio = (index + 1) / (steps + 1);
        return swatch(withLightness(rgb, base.l + (LIGHTEST - base.l) * ratio));
      });
    }
    case 'shades': {
      return Array.from({ length: steps }, (_, index) => {
        const ratio = (index + 1) / (steps + 1);
        return swatch(withLightness(rgb, base.l - (base.l - DARKEST) * ratio));
      });
    }
    case 'complementary':
      return [swatch(rgb), swatch(rotated(rgb, COMPLEMENT_ANGLE))];
    case 'analogous':
      return [
        swatch(rotated(rgb, -ANALOGOUS_ANGLE)),
        swatch(rgb),
        swatch(rotated(rgb, ANALOGOUS_ANGLE)),
      ];
    default:
      return [
        swatch(rgb),
        swatch(rotated(rgb, TRIADIC_ANGLE)),
        swatch(rotated(rgb, -TRIADIC_ANGLE)),
      ];
  }
}

/** The whole palette as CSS custom properties, ready to paste. */
export function paletteToCss(
  swatches: readonly Swatch[],
  name: string,
): string {
  return swatches
    .map((entry, index) => `  --${name}-${index + 1}: ${entry.hex};`)
    .join('\n');
}
