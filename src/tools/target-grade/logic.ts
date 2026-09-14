export const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D'] as const;
export type Grade = (typeof GRADES)[number];

/** The scale most Thai courses print on the syllabus. */
export const DEFAULT_CUTOFFS: Readonly<Record<Grade, number>> = {
  A: 80,
  'B+': 75,
  B: 70,
  'C+': 65,
  C: 60,
  'D+': 55,
  D: 50,
};

export const FULL_WEIGHT = 100;
export const MAX_ITEMS = 30;
export const SCORE_PLACES = 2;

const NUMBER = /^-?\d*\.?\d*$/;
const ITEM_FIELDS = 4;

export interface RawItem {
  id: string;
  name: string;
  score: string;
  max: string;
  weight: string;
}

export type ItemIssue = 'max-not-positive' | 'score-negative' | 'score-above-max' | 'weight-negative';

export function emptyItem(id: string): RawItem {
  return { id, name: '', score: '', max: '', weight: '' };
}

/** Blank counts as zero; anything that is not a number at all counts as nothing. */
export function toNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  if (!NUMBER.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function itemIssue(item: RawItem): ItemIssue | null {
  const score = toNumber(item.score);
  const max = toNumber(item.max);
  const weight = toNumber(item.weight);

  if (max === null || max <= 0) return 'max-not-positive';
  if (score === null || score < 0) return 'score-negative';
  if (score > max) return 'score-above-max';
  if (weight === null || weight < 0) return 'weight-negative';

  return null;
}

/** The percentage points this item contributes to the course total. */
export function itemContribution(item: RawItem): number | null {
  if (itemIssue(item) !== null) return null;

  const score = toNumber(item.score) ?? 0;
  const max = toNumber(item.max) ?? 1;
  const weight = toNumber(item.weight) ?? 0;

  return (score / max) * weight;
}

export interface Standing {
  earned: number;
  completedWeight: number;
  finalWeight: number;
  totalWeight: number;
  /** The best possible outcome: everything earned plus a perfect final. */
  ceiling: number;
}

export function standingOf(items: RawItem[], finalWeightRaw: string): Standing {
  const usable = items.filter((item) => itemIssue(item) === null);

  const earned = usable.reduce((sum, item) => sum + (itemContribution(item) ?? 0), 0);
  const completedWeight = usable.reduce(
    (sum, item) => sum + (toNumber(item.weight) ?? 0),
    0,
  );

  const parsed = toNumber(finalWeightRaw);
  const finalWeight = parsed === null || parsed < 0 ? 0 : parsed;

  return {
    earned,
    completedWeight,
    finalWeight,
    totalWeight: completedWeight + finalWeight,
    ceiling: earned + finalWeight,
  };
}

export type RequirementState = 'secured' | 'possible' | 'impossible' | 'no-final';

export interface Requirement {
  grade: Grade;
  cutoff: number;
  /** Percent of the final exam needed, or null when the exam cannot decide it. */
  needed: number | null;
  state: RequirementState;
}

export function requirementFor(
  grade: Grade,
  cutoff: number,
  standing: Standing,
): Requirement {
  if (standing.earned >= cutoff) {
    return { grade, cutoff, needed: null, state: 'secured' };
  }

  if (standing.finalWeight <= 0) {
    return { grade, cutoff, needed: null, state: 'no-final' };
  }

  const needed = ((cutoff - standing.earned) / standing.finalWeight) * FULL_WEIGHT;

  if (needed > FULL_WEIGHT) {
    return { grade, cutoff, needed, state: 'impossible' };
  }

  return { grade, cutoff, needed, state: 'possible' };
}

export function requirementsFor(
  standing: Standing,
  cutoffs: Record<Grade, number>,
): Requirement[] {
  return GRADES.map((grade) => requirementFor(grade, cutoffs[grade], standing));
}

export type WeightWarning = 'under' | 'over' | null;

export function weightWarning(standing: Standing): WeightWarning {
  if (standing.totalWeight === FULL_WEIGHT) return null;
  return standing.totalWeight < FULL_WEIGHT ? 'under' : 'over';
}

export function cutoffsDescend(cutoffs: Record<Grade, number>): boolean {
  return GRADES.every((grade, index) => {
    const next = GRADES[index + 1];
    return next === undefined || cutoffs[grade] > cutoffs[next];
  });
}

export function roundScore(value: number): number {
  const factor = 10 ** SCORE_PLACES;
  return Math.round(value * factor) / factor;
}

/**
 * Items travel in the link as an array of tuples. JSON rather than a separator,
 * because a task called "Quiz 1, part 2" would break any separator worth
 * reading.
 */
export function encodeItems(items: RawItem[]): string {
  const tuples = items
    .filter((item) => item.name.length + item.score.length + item.max.length > 0)
    .map((item) => [item.name, item.score, item.max, item.weight]);

  return tuples.length === 0 ? '' : JSON.stringify(tuples);
}

export function decodeItems(raw: string | undefined): RawItem[] {
  if (raw === undefined || raw.trim().length === 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .slice(0, MAX_ITEMS)
    .filter(
      (tuple): tuple is string[] =>
        Array.isArray(tuple) &&
        tuple.length === ITEM_FIELDS &&
        tuple.every((field) => typeof field === 'string'),
    )
    .map((tuple, index) => ({
      id: `url-${index}`,
      name: tuple[0] ?? '',
      score: tuple[1] ?? '',
      max: tuple[2] ?? '',
      weight: tuple[3] ?? '',
    }));
}

export function encodeCutoffs(cutoffs: Record<Grade, number>): string {
  return GRADES.map((grade) => cutoffs[grade]).join(',');
}

export function decodeCutoffs(raw: string | undefined): Record<Grade, number> {
  if (raw === undefined) return { ...DEFAULT_CUTOFFS };

  const parts = raw.split(',');
  if (parts.length !== GRADES.length) return { ...DEFAULT_CUTOFFS };

  const cutoffs = { ...DEFAULT_CUTOFFS };
  for (const [index, grade] of GRADES.entries()) {
    const value = Number(parts[index]);
    if (!Number.isFinite(value)) return { ...DEFAULT_CUTOFFS };
    cutoffs[grade] = value;
  }

  return cutoffs;
}
