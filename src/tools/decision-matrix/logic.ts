import { asArray, asNumber, asString, isRecord, storedSchema } from '@/lib/schema';

export const MATRIX_SCHEMA = 1;

export const MAX_OPTIONS = 12;
export const MAX_CRITERIA = 12;
export const MAX_SAVED = 20;
export const MAX_NAME_LENGTH = 60;

export const MIN_SCORE = 0;
export const MAX_SCORE = 10;
export const FULL_WEIGHT = 100;
export const SCORE_PLACES = 2;

export interface Criterion {
  id: string;
  name: string;
  /** Percentage points; the tool warns when they do not add to 100. */
  weight: number;
}

export interface Option {
  id: string;
  name: string;
  /** Criterion id to a score from 0 to 10. */
  scores: Record<string, number>;
}

export interface Decision {
  id: string;
  name: string;
  criteria: Criterion[];
  options: Option[];
}

export interface MatrixData {
  schema: number;
  decisions: Decision[];
  nextId: number;
}

export const EMPTY_DATA: MatrixData = { schema: MATRIX_SCHEMA, decisions: [], nextId: 1 };

export function emptyDecision(id: string, name: string): Decision {
  return { id, name, criteria: [], options: [] };
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return MIN_SCORE;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(value * 10) / 10));
}

export function clampWeight(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(FULL_WEIGHT, Math.round(value));
}

export function totalWeight(decision: Decision): number {
  return decision.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
}

export type WeightWarning = 'under' | 'over' | null;

export function weightWarning(decision: Decision): WeightWarning {
  const total = totalWeight(decision);
  if (decision.criteria.length === 0 || total === FULL_WEIGHT) return null;

  return total < FULL_WEIGHT ? 'under' : 'over';
}

/**
 * Rescales the weights so they add to 100 while keeping their proportions.
 * The largest one absorbs the rounding, so the total is exactly 100 rather
 * than 99 or 101.
 */
export function normalizeWeights(decision: Decision): Decision {
  const total = totalWeight(decision);
  if (decision.criteria.length === 0 || total <= 0) return decision;

  const scaled = decision.criteria.map((criterion) => ({
    ...criterion,
    weight: Math.round((criterion.weight / total) * FULL_WEIGHT),
  }));

  const drift = FULL_WEIGHT - scaled.reduce((sum, criterion) => sum + criterion.weight, 0);

  if (drift !== 0) {
    let largest = 0;
    scaled.forEach((criterion, index) => {
      if (criterion.weight > (scaled[largest]?.weight ?? 0)) largest = index;
    });

    const target = scaled[largest];
    if (target) target.weight = Math.max(0, target.weight + drift);
  }

  return { ...decision, criteria: scaled };
}

export function scoreOf(option: Option, decision: Decision): number {
  const total = totalWeight(decision);
  if (total <= 0) return 0;

  const weighted = decision.criteria.reduce(
    (sum, criterion) => sum + clampScore(option.scores[criterion.id] ?? 0) * criterion.weight,
    0,
  );

  return Math.round((weighted / total) * 10 ** SCORE_PLACES) / 10 ** SCORE_PLACES;
}

export interface Ranked {
  option: Option;
  score: number;
  rank: number;
}

/** Ties share a rank, and the next one skips, the way a leaderboard reads. */
export function ranking(decision: Decision): Ranked[] {
  const scored = decision.options
    .map((option) => ({ option, score: scoreOf(option, decision), rank: 0 }))
    .sort((left, right) => right.score - left.score);

  let lastScore = Number.NaN;
  let lastRank = 0;

  scored.forEach((entry, index) => {
    if (entry.score === lastScore) {
      entry.rank = lastRank;
      return;
    }

    entry.rank = index + 1;
    lastScore = entry.score;
    lastRank = entry.rank;
  });

  return scored;
}

export type MatrixAction =
  | { type: 'add-option'; name: string }
  | { type: 'rename-option'; id: string; name: string }
  | { type: 'remove-option'; id: string }
  | { type: 'add-criterion'; name: string }
  | { type: 'rename-criterion'; id: string; name: string }
  | { type: 'reweight'; id: string; weight: number }
  | { type: 'remove-criterion'; id: string }
  | { type: 'score'; optionId: string; criterionId: string; score: number }
  | { type: 'normalize'}
  | { type: 'rename'; name: string };

export function reduceDecision(
  decision: Decision,
  action: MatrixAction,
  nextId: number,
): { decision: Decision; used: boolean } {
  switch (action.type) {
    case 'add-option': {
      const name = action.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name.length === 0 || decision.options.length >= MAX_OPTIONS) {
        return { decision, used: false };
      }

      return {
        decision: {
          ...decision,
          options: [...decision.options, { id: `o${nextId}`, name, scores: {} }],
        },
        used: true,
      };
    }

    case 'add-criterion': {
      const name = action.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name.length === 0 || decision.criteria.length >= MAX_CRITERIA) {
        return { decision, used: false };
      }

      return {
        decision: {
          ...decision,
          criteria: [...decision.criteria, { id: `c${nextId}`, name, weight: 0 }],
        },
        used: true,
      };
    }

    case 'rename-option':
      return {
        decision: {
          ...decision,
          options: decision.options.map((option) =>
            option.id === action.id
              ? { ...option, name: action.name.slice(0, MAX_NAME_LENGTH) }
              : option,
          ),
        },
        used: false,
      };

    case 'remove-option':
      return {
        decision: {
          ...decision,
          options: decision.options.filter((option) => option.id !== action.id),
        },
        used: false,
      };

    case 'rename-criterion':
      return {
        decision: {
          ...decision,
          criteria: decision.criteria.map((criterion) =>
            criterion.id === action.id
              ? { ...criterion, name: action.name.slice(0, MAX_NAME_LENGTH) }
              : criterion,
          ),
        },
        used: false,
      };

    case 'reweight':
      return {
        decision: {
          ...decision,
          criteria: decision.criteria.map((criterion) =>
            criterion.id === action.id
              ? { ...criterion, weight: clampWeight(action.weight) }
              : criterion,
          ),
        },
        used: false,
      };

    case 'remove-criterion':
      return {
        decision: {
          ...decision,
          criteria: decision.criteria.filter((criterion) => criterion.id !== action.id),
          options: decision.options.map((option) => {
            const scores = { ...option.scores };
            delete scores[action.id];
            return { ...option, scores };
          }),
        },
        used: false,
      };

    case 'score':
      return {
        decision: {
          ...decision,
          options: decision.options.map((option) =>
            option.id === action.optionId
              ? {
                  ...option,
                  scores: {
                    ...option.scores,
                    [action.criterionId]: clampScore(action.score),
                  },
                }
              : option,
          ),
        },
        used: false,
      };

    case 'normalize':
      return { decision: normalizeWeights(decision), used: false };

    default:
      return {
        decision: { ...decision, name: action.name.slice(0, MAX_NAME_LENGTH) },
        used: false,
      };
  }
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data)) return 0;
  return Array.isArray(data.decisions) ? data.decisions.length : 0;
}

export function migrateDecision(raw: unknown, index: number): Decision {
  if (!isRecord(raw)) return emptyDecision(`d${index}`, '');

  const criteria = asArray(raw.criteria)
    .slice(0, MAX_CRITERIA)
    .filter(isRecord)
    .map((criterion, position) => ({
      id: asString(criterion.id, `c${position}`),
      name: asString(criterion.name).slice(0, MAX_NAME_LENGTH),
      weight: clampWeight(asNumber(criterion.weight, 0)),
    }))
    .filter((criterion) => criterion.name.length > 0);

  const known = new Set(criteria.map((criterion) => criterion.id));

  const options = asArray(raw.options)
    .slice(0, MAX_OPTIONS)
    .filter(isRecord)
    .map((option, position) => {
      const scores: Record<string, number> = {};

      if (isRecord(option.scores)) {
        for (const [id, value] of Object.entries(option.scores)) {
          // A score for a criterion that is gone would weight nothing and
          // reappear if a new criterion happened to reuse the id.
          if (known.has(id)) scores[id] = clampScore(asNumber(value, 0));
        }
      }

      return {
        id: asString(option.id, `o${position}`),
        name: asString(option.name).slice(0, MAX_NAME_LENGTH),
        scores,
      };
    })
    .filter((option) => option.name.length > 0);

  return {
    id: asString(raw.id, `d${index}`),
    name: asString(raw.name).slice(0, MAX_NAME_LENGTH),
    criteria,
    options,
  };
}

export function migrate(raw: unknown): MatrixData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw) || version > MATRIX_SCHEMA) return EMPTY_DATA;

  const decisions = asArray(raw.decisions)
    .slice(0, MAX_SAVED)
    .map(migrateDecision)
    .filter((decision) => decision.name.length > 0);

  const highest = decisions
    .flatMap((decision) => [
      decision.id,
      ...decision.criteria.map((criterion) => criterion.id),
      ...decision.options.map((option) => option.id),
    ])
    .reduce((top, id) => {
      const numeric = Number(id.replace(/\D/g, ''));
      return Number.isFinite(numeric) ? Math.max(top, numeric) : top;
    }, 0);

  return {
    schema: MATRIX_SCHEMA,
    decisions,
    nextId: Math.max(asNumber(raw.nextId, 1), highest + 1),
  };
}

/** One decision, small enough to travel in a link. */
export function encodeDecision(decision: Decision): string {
  return JSON.stringify([
    decision.name,
    decision.criteria.map((criterion) => [criterion.id, criterion.name, criterion.weight]),
    decision.options.map((option) => [
      option.id,
      option.name,
      Object.entries(option.scores),
    ]),
  ]);
}

export function decodeDecision(raw: string | undefined, id: string): Decision | null {
  if (raw === undefined || raw.trim().length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length !== 3) return null;

  const [name, rawCriteria, rawOptions] = parsed;
  if (typeof name !== 'string' || name.trim().length === 0) return null;

  return migrateDecision(
    {
      id,
      name,
      criteria: (Array.isArray(rawCriteria) ? rawCriteria : [])
        .filter((entry): entry is [string, string, number] => Array.isArray(entry))
        .map((entry) => ({ id: entry[0], name: entry[1], weight: entry[2] })),
      options: (Array.isArray(rawOptions) ? rawOptions : [])
        .filter((entry): entry is [string, string, Array<[string, number]>] =>
          Array.isArray(entry),
        )
        .map((entry) => ({
          id: entry[0],
          name: entry[1],
          scores: Object.fromEntries(Array.isArray(entry[2]) ? entry[2] : []),
        })),
    },
    0,
  );
}

/**
 * Rewrites every id so a decision opened from a link can be saved beside ones
 * already stored. Without it, saving the same link twice would produce two
 * decisions whose criteria share ids, and scoring one would move the other.
 */
export function withFreshIds(
  decision: Decision,
  startId: number,
): { decision: Decision; nextId: number } {
  let next = startId;

  const id = `d${next}`;
  next += 1;

  const criterionIds = new Map<string, string>();
  const criteria = decision.criteria.map((criterion) => {
    const fresh = `c${next}`;
    next += 1;
    criterionIds.set(criterion.id, fresh);
    return { ...criterion, id: fresh };
  });

  const options = decision.options.map((option) => {
    const fresh = `o${next}`;
    next += 1;

    return {
      ...option,
      id: fresh,
      scores: Object.fromEntries(
        Object.entries(option.scores).map(([criterionId, score]) => [
          criterionIds.get(criterionId) ?? criterionId,
          score,
        ]),
      ),
    };
  });

  return { decision: { id, name: decision.name, criteria, options }, nextId: next };
}
