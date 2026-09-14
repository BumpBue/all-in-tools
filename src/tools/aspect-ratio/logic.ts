export interface Ratio {
  width: number;
  height: number;
}

export interface Preset extends Ratio {
  id: string;
  name: { th: string; en: string };
  group: 'common' | 'social';
  /** Exact pixel size a platform expects, when there is one. */
  pixels?: Ratio;
}

export const PRESETS: readonly Preset[] = [
  { id: '16-9', width: 16, height: 9, group: 'common', name: { th: '16:9 จอกว้าง', en: '16:9 widescreen' } },
  { id: '4-3', width: 4, height: 3, group: 'common', name: { th: '4:3 จอเก่า', en: '4:3 classic' } },
  { id: '1-1', width: 1, height: 1, group: 'common', name: { th: '1:1 จัตุรัส', en: '1:1 square' } },
  { id: '9-16', width: 9, height: 16, group: 'common', name: { th: '9:16 แนวตั้ง', en: '9:16 vertical' } },
  { id: '3-2', width: 3, height: 2, group: 'common', name: { th: '3:2 ภาพถ่าย', en: '3:2 photo' } },
  { id: '21-9', width: 21, height: 9, group: 'common', name: { th: '21:9 อัลตราไวด์', en: '21:9 ultrawide' } },

  {
    id: 'ig-post',
    width: 1,
    height: 1,
    group: 'social',
    name: { th: 'Instagram โพสต์', en: 'Instagram post' },
    pixels: { width: 1080, height: 1080 },
  },
  {
    id: 'ig-portrait',
    width: 4,
    height: 5,
    group: 'social',
    name: { th: 'Instagram โพสต์แนวตั้ง', en: 'Instagram portrait post' },
    pixels: { width: 1080, height: 1350 },
  },
  {
    id: 'ig-story',
    width: 9,
    height: 16,
    group: 'social',
    name: { th: 'Instagram สตอรี่ / รีล', en: 'Instagram story and reel' },
    pixels: { width: 1080, height: 1920 },
  },
  {
    id: 'fb-post',
    width: 1200,
    height: 630,
    group: 'social',
    name: { th: 'Facebook โพสต์', en: 'Facebook post' },
    pixels: { width: 1200, height: 630 },
  },
  {
    id: 'fb-cover',
    width: 851,
    height: 315,
    group: 'social',
    name: { th: 'Facebook ปก', en: 'Facebook cover' },
    pixels: { width: 851, height: 315 },
  },
  {
    id: 'yt-thumb',
    width: 16,
    height: 9,
    group: 'social',
    name: { th: 'YouTube ปกวิดีโอ', en: 'YouTube thumbnail' },
    pixels: { width: 1280, height: 720 },
  },
  {
    id: 'yt-banner',
    width: 16,
    height: 9,
    group: 'social',
    name: { th: 'YouTube แบนเนอร์ช่อง', en: 'YouTube channel banner' },
    pixels: { width: 2560, height: 1440 },
  },
  {
    id: 'tiktok',
    width: 9,
    height: 16,
    group: 'social',
    name: { th: 'TikTok', en: 'TikTok' },
    pixels: { width: 1080, height: 1920 },
  },
  {
    id: 'x-post',
    width: 16,
    height: 9,
    group: 'social',
    name: { th: 'X โพสต์', en: 'X post' },
    pixels: { width: 1600, height: 900 },
  },
];

export const MIN_DIMENSION = 1;
export const MAX_DIMENSION = 100_000;

export function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));

  while (right !== 0) {
    [left, right] = [right, left % right];
  }

  return left;
}

export function simplifyRatio(width: number, height: number): Ratio | null {
  if (!isUsable(width) || !isUsable(height)) return null;

  const divisor = greatestCommonDivisor(width, height);
  if (divisor === 0) return null;

  return { width: Math.round(width) / divisor, height: Math.round(height) / divisor };
}

export function isUsable(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_DIMENSION && value <= MAX_DIMENSION;
}

/** The other side, unrounded, for a given ratio. */
export function heightFor(width: number, ratio: Ratio): number {
  return (width * ratio.height) / ratio.width;
}

export function widthFor(height: number, ratio: Ratio): number {
  return (height * ratio.width) / ratio.height;
}

export interface RoundingDrift {
  /** The ratio actually produced by the rounded whole numbers. */
  actual: Ratio | null;
  /** How far the rounded pair is from the requested ratio, as a percentage. */
  driftPercent: number;
  exact: boolean;
}

/**
 * Whole pixels rarely land on the ratio exactly, and a caller who is told
 * "1080 x 607" deserves to know it is not quite 16:9.
 */
export function roundingDrift(
  width: number,
  height: number,
  ratio: Ratio,
): RoundingDrift {
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);

  if (!isUsable(roundedWidth) || !isUsable(roundedHeight)) {
    return { actual: null, driftPercent: 0, exact: false };
  }

  const wanted = ratio.width / ratio.height;
  const got = roundedWidth / roundedHeight;
  const driftPercent = Math.abs((got - wanted) / wanted) * 100;

  return {
    actual: simplifyRatio(roundedWidth, roundedHeight),
    driftPercent,
    exact: roundedWidth * ratio.height === roundedHeight * ratio.width,
  };
}

export function formatRatio(ratio: Ratio | null): string {
  return ratio === null ? '' : `${ratio.width}:${ratio.height}`;
}

export function parseDimension(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, '');
  if (trimmed.length === 0) return null;

  const value = Number(trimmed);
  return isUsable(value) ? value : null;
}

const RATIO_TEXT = /^(\d+(?:\.\d+)?)\s*[:/x×]\s*(\d+(?:\.\d+)?)$/i;

/** Reads a target ratio such as "16:9", kept apart from the current numbers. */
export function parseRatio(raw: string): Ratio | null {
  const match = RATIO_TEXT.exec(raw.trim());
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  return isUsable(width) && isUsable(height) ? { width, height } : null;
}
