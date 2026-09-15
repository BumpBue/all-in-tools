import { createRandom } from '@/lib/random';

export const MAX_OPTIONS = 24;
export const MIN_OPTIONS = 2;
export const MAX_WEIGHT = 99;
export const MAX_HISTORY = 50;
export const MAX_PRESETS = 20;

export const FULL_TURN = 360;
export const SPIN_TURNS = 5;
export const SPIN_MS = 4_000;

/** Enough hues to go round the wheel without two neighbours matching. */
export const SEGMENT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
] as const;

export interface WheelOption {
  id: string;
  label: string;
  weight: number;
  /** Set when the draw-without-replacement mode has already taken it. */
  removed: boolean;
}

export interface WheelPreset {
  id: string;
  name: string;
  options: Array<{ label: string; weight: number }>;
}

export interface HistoryEntry {
  label: string;
}

export interface WheelStorage {
  presets: WheelPreset[];
  history: HistoryEntry[];
}

export const EMPTY_STORAGE: WheelStorage = { presets: [], history: [] };

export function emptyOption(id: string, label = ''): WheelOption {
  return { id, label, weight: 1, removed: false };
}

export function activeOptions(options: WheelOption[]): WheelOption[] {
  return options.filter((option) => !option.removed && option.label.trim().length > 0);
}

export function totalWeight(options: WheelOption[]): number {
  return activeOptions(options).reduce((sum, option) => sum + Math.max(0, option.weight), 0);
}

/**
 * The winner is drawn first and the wheel is animated to land on it, rather
 * than the other way round: a physics simulation would decide the result by
 * how the numbers rounded, and could not be weighted honestly.
 */
export function pickWinner(
  options: WheelOption[],
  random: () => number = createRandom(null),
): WheelOption | null {
  const live = activeOptions(options);
  if (live.length === 0) return null;

  const total = totalWeight(options);
  if (total <= 0) return live[Math.floor(random() * live.length)] ?? null;

  let ticket = random() * total;
  for (const option of live) {
    ticket -= Math.max(0, option.weight);
    if (ticket < 0) return option;
  }

  return live[live.length - 1] ?? null;
}

export interface Segment {
  option: WheelOption;
  /** Degrees, clockwise from the top. */
  start: number;
  end: number;
  color: string;
}

export function buildSegments(options: WheelOption[]): Segment[] {
  const live = activeOptions(options);
  const total = totalWeight(options);
  if (live.length === 0) return [];

  const segments: Segment[] = [];
  let cursor = 0;

  live.forEach((option, index) => {
    const share =
      total <= 0
        ? FULL_TURN / live.length
        : (Math.max(0, option.weight) / total) * FULL_TURN;

    segments.push({
      option,
      start: cursor,
      end: cursor + share,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? '#888888',
    });

    cursor += share;
  });

  return segments;
}

/**
 * How far to turn so the pointer at the top ends inside the winner's segment.
 * Several whole turns are added so it looks like a spin rather than a jump.
 */
export function angleForWinner(
  segments: Segment[],
  winnerId: string,
  currentAngle: number,
  random: () => number = createRandom(null),
): number {
  const segment = segments.find((each) => each.option.id === winnerId);
  if (!segment) return currentAngle;

  // Land somewhere inside the segment rather than always dead centre.
  const inset = (segment.end - segment.start) * 0.15;
  const target =
    segment.start + inset + random() * Math.max(0, segment.end - segment.start - inset * 2);

  const pointerAngle = (FULL_TURN - target) % FULL_TURN;
  const turns = SPIN_TURNS * FULL_TURN;
  const base = Math.ceil(currentAngle / FULL_TURN) * FULL_TURN;

  return base + turns + pointerAngle;
}

/** Which option the pointer is over, for a wheel that was turned by hand. */
export function optionAtAngle(segments: Segment[], angle: number): WheelOption | null {
  if (segments.length === 0) return null;

  const normalized = ((FULL_TURN - (angle % FULL_TURN)) + FULL_TURN) % FULL_TURN;
  const found = segments.find(
    (segment) => normalized >= segment.start && normalized < segment.end,
  );

  return found?.option ?? segments[segments.length - 1]?.option ?? null;
}

export function easeOut(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return 1 - (1 - clamped) ** 3;
}

export function countStoredItems(data: unknown): number {
  if (typeof data !== 'object' || data === null) return 0;

  const storage = data as Partial<WheelStorage>;
  const presets = Array.isArray(storage.presets) ? storage.presets.length : 0;
  const history = Array.isArray(storage.history) ? storage.history.length : 0;

  return presets + history;
}

const OPTION_SEPARATOR = '\n';

export function optionsToText(options: WheelOption[]): string {
  return options
    .map((option) =>
      option.weight === 1 ? option.label : `${option.label} x${option.weight}`,
    )
    .join(OPTION_SEPARATOR);
}

const WEIGHTED = /^(.*?)\s*x(\d+)$/;

export function optionsFromText(text: string): WheelOption[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_OPTIONS)
    .map((line, index) => {
      const weighted = WEIGHTED.exec(line);
      if (weighted) {
        return {
          id: `text-${index}`,
          label: (weighted[1] ?? '').trim(),
          weight: Math.min(MAX_WEIGHT, Math.max(1, Number(weighted[2]))),
          removed: false,
        };
      }

      return { id: `text-${index}`, label: line, weight: 1, removed: false };
    })
    .filter((option) => option.label.length > 0);
}

// Options travel as JSON tuples: a label may hold anything a reader types.
export function encodeOptions(options: WheelOption[]): string {
  const live = options.filter((option) => option.label.trim().length > 0);
  if (live.length === 0) return '';

  return JSON.stringify(live.map((option) => [option.label, option.weight]));
}

export function decodeOptions(raw: string | undefined): WheelOption[] {
  if (raw === undefined || raw.trim().length === 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .slice(0, MAX_OPTIONS)
    .filter(
      (tuple): tuple is [string, number] =>
        Array.isArray(tuple) &&
        tuple.length === 2 &&
        typeof tuple[0] === 'string' &&
        typeof tuple[1] === 'number' &&
        Number.isFinite(tuple[1]),
    )
    .map((tuple, index) => ({
      id: `url-${index}`,
      label: tuple[0],
      weight: Math.min(MAX_WEIGHT, Math.max(1, Math.floor(tuple[1]))),
      removed: false,
    }))
    .filter((option) => option.label.trim().length > 0);
}
