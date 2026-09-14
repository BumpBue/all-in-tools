import { parseColor, rgbToHex, type Rgb } from '@/lib/color';

export const TABS = ['shadow', 'gradient'] as const;
export type Tab = (typeof TABS)[number];

export const GRADIENT_KINDS = ['linear', 'radial', 'conic'] as const;
export type GradientKind = (typeof GRADIENT_KINDS)[number];

export const MAX_LAYERS = 8;
export const MAX_STOPS = 8;
export const MIN_STOPS = 2;

export const ALPHA_PLACES = 2;
const PERCENT = 100;
const DEGREES = 360;

export interface ShadowLayer {
  id: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** Hex, with the alpha kept apart so a slider can drive it. */
  color: string;
  alpha: number;
  inset: boolean;
}

export interface GradientStop {
  id: string;
  color: string;
  position: number;
}

export interface Gradient {
  kind: GradientKind;
  angle: number;
  stops: GradientStop[];
}

export const DEFAULT_SHADOW: Omit<ShadowLayer, 'id'> = {
  x: 0,
  y: 1,
  blur: 3,
  spread: 0,
  color: '#000000',
  alpha: 0.2,
  inset: false,
};

export const DEFAULT_GRADIENT: Omit<Gradient, 'stops'> = { kind: 'linear', angle: 135 };

export function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, Math.round(value * 10 ** ALPHA_PLACES) / 10 ** ALPHA_PLACES));
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(PERCENT, Math.max(0, Math.round(value)));
}

export function clampAngle(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % DEGREES) + DEGREES) % DEGREES;
}

function toRgb(color: string): Rgb {
  return parseColor(color) ?? { r: 0, g: 0, b: 0, a: 1 };
}

/** Written without spaces after the commas, so the Tailwind form needs no repair. */
export function formatRgba(color: string, alpha: number): string {
  const { r, g, b } = toRgb(color);
  const opacity = clampAlpha(alpha);

  return opacity >= 1
    ? rgbToHex({ r, g, b, a: 1 })
    : `rgba(${r},${g},${b},${opacity})`;
}

export function formatLayer(layer: ShadowLayer): string {
  const parts = [
    layer.inset ? 'inset' : '',
    `${layer.x}px`,
    `${layer.y}px`,
    `${layer.blur}px`,
    layer.spread === 0 ? '' : `${layer.spread}px`,
    formatRgba(layer.color, layer.alpha),
  ].filter((part) => part.length > 0);

  return parts.join(' ');
}

export function formatShadow(layers: ShadowLayer[]): string {
  if (layers.length === 0) return 'none';
  return layers.map(formatLayer).join(', ');
}

export function formatStop(stop: GradientStop): string {
  return `${stop.color} ${clampPercent(stop.position)}%`;
}

export function formatGradient(gradient: Gradient): string {
  const stops = [...gradient.stops]
    .sort((left, right) => left.position - right.position)
    .map(formatStop)
    .join(', ');

  if (gradient.kind === 'linear') {
    return `linear-gradient(${clampAngle(gradient.angle)}deg, ${stops})`;
  }
  if (gradient.kind === 'radial') {
    return `radial-gradient(circle at center, ${stops})`;
  }

  return `conic-gradient(from ${clampAngle(gradient.angle)}deg at center, ${stops})`;
}

/**
 * Tailwind reads an arbitrary value up to the first space, and turns every
 * underscore back into one. Commas are left alone, which is why the colour
 * helper never writes a space after one.
 */
export function toArbitrary(prefix: string, value: string): string {
  return `${prefix}-[${value.replace(/,\s+/g, ',').replace(/ /g, '_')}]`;
}

export function shadowCss(layers: ShadowLayer[]): string {
  return `box-shadow: ${formatShadow(layers)};`;
}

export function gradientCss(gradient: Gradient): string {
  return `background-image: ${formatGradient(gradient)};`;
}

export interface Preset<T> {
  id: string;
  th: string;
  en: string;
  value: T;
}

export const SHADOW_PRESETS: ReadonlyArray<Preset<Array<Omit<ShadowLayer, 'id'>>>> = [
  {
    id: 'subtle',
    th: 'บางๆ',
    en: 'Subtle',
    value: [{ ...DEFAULT_SHADOW, y: 1, blur: 2, alpha: 0.08 }],
  },
  {
    id: 'card',
    th: 'การ์ด',
    en: 'Card',
    value: [
      { ...DEFAULT_SHADOW, y: 1, blur: 2, alpha: 0.06 },
      { ...DEFAULT_SHADOW, y: 4, blur: 12, spread: -2, alpha: 0.1 },
    ],
  },
  {
    id: 'floating',
    th: 'ลอย',
    en: 'Floating',
    value: [
      { ...DEFAULT_SHADOW, y: 2, blur: 4, alpha: 0.06 },
      { ...DEFAULT_SHADOW, y: 12, blur: 32, spread: -4, alpha: 0.18 },
    ],
  },
  {
    id: 'inset',
    th: 'กดลงไป',
    en: 'Pressed in',
    value: [{ ...DEFAULT_SHADOW, y: 2, blur: 4, alpha: 0.15, inset: true }],
  },
];

export const GRADIENT_PRESETS: ReadonlyArray<
  Preset<{ kind: GradientKind; angle: number; stops: Array<Omit<GradientStop, 'id'>> }>
> = [
  {
    id: 'sunset',
    th: 'พระอาทิตย์ตก',
    en: 'Sunset',
    value: {
      kind: 'linear',
      angle: 135,
      stops: [
        { color: '#ff8a3d', position: 0 },
        { color: '#ff4d6d', position: 55 },
        { color: '#6a3093', position: 100 },
      ],
    },
  },
  {
    id: 'ocean',
    th: 'ทะเล',
    en: 'Ocean',
    value: {
      kind: 'linear',
      angle: 160,
      stops: [
        { color: '#2af598', position: 0 },
        { color: '#009efd', position: 100 },
      ],
    },
  },
  {
    id: 'spotlight',
    th: 'สปอตไลต์',
    en: 'Spotlight',
    value: {
      kind: 'radial',
      angle: 0,
      stops: [
        { color: '#ffffff', position: 0 },
        { color: '#c7d2fe', position: 60 },
        { color: '#4338ca', position: 100 },
      ],
    },
  },
  {
    id: 'wheel',
    th: 'วงล้อสี',
    en: 'Colour wheel',
    value: {
      kind: 'conic',
      angle: 0,
      stops: [
        { color: '#ef4444', position: 0 },
        { color: '#eab308', position: 25 },
        { color: '#22c55e', position: 50 },
        { color: '#3b82f6', position: 75 },
        { color: '#ef4444', position: 100 },
      ],
    },
  },
];

// Both shapes travel as JSON tuples: a colour is a string that may hold a
// comma, and a separator would have to be escaped anyway.
export function encodeLayers(layers: ShadowLayer[]): string {
  if (layers.length === 0) return '';

  return JSON.stringify(
    layers.map((layer) => [
      layer.x,
      layer.y,
      layer.blur,
      layer.spread,
      layer.color,
      layer.alpha,
      layer.inset ? 1 : 0,
    ]),
  );
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function decodeLayers(raw: string | undefined): ShadowLayer[] {
  if (raw === undefined || raw.length === 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .slice(0, MAX_LAYERS)
    .filter(
      (tuple): tuple is [number, number, number, number, string, number, number] =>
        Array.isArray(tuple) &&
        tuple.length === 7 &&
        tuple.slice(0, 4).every(isNumber) &&
        typeof tuple[4] === 'string' &&
        isNumber(tuple[5]),
    )
    .map((tuple, index) => ({
      id: `url-${index}`,
      x: tuple[0],
      y: tuple[1],
      blur: Math.max(0, tuple[2]),
      spread: tuple[3],
      color: parseColor(tuple[4]) === null ? '#000000' : tuple[4],
      alpha: clampAlpha(tuple[5]),
      inset: tuple[6] === 1,
    }));
}

export function encodeGradient(gradient: Gradient): string {
  return JSON.stringify([
    gradient.kind,
    gradient.angle,
    gradient.stops.map((stop) => [stop.color, stop.position]),
  ]);
}

export function decodeGradient(raw: string | undefined): Gradient | null {
  if (raw === undefined || raw.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== 3) return null;

  const [kind, angle, stops] = parsed;
  if (!GRADIENT_KINDS.includes(kind as GradientKind)) return null;
  if (!isNumber(angle) || !Array.isArray(stops)) return null;

  const decoded = stops
    .slice(0, MAX_STOPS)
    .filter(
      (tuple): tuple is [string, number] =>
        Array.isArray(tuple) &&
        tuple.length === 2 &&
        typeof tuple[0] === 'string' &&
        parseColor(tuple[0]) !== null &&
        isNumber(tuple[1]),
    )
    .map((tuple, index) => ({
      id: `url-${index}`,
      color: tuple[0],
      position: clampPercent(tuple[1]),
    }));

  if (decoded.length < MIN_STOPS) return null;

  return { kind: kind as GradientKind, angle: clampAngle(angle), stops: decoded };
}
