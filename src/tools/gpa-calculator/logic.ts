import { asArray, asNumber, asString, isRecord, storedSchema } from '@/lib/schema';

export const GPA_SCHEMA = 1;

export const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'] as const;
export type Grade = (typeof GRADES)[number];

/** The Thai four-point scale. */
export const GRADE_POINTS: Readonly<Record<Grade, number>> = {
  A: 4,
  'B+': 3.5,
  B: 3,
  'C+': 2.5,
  C: 2,
  'D+': 1.5,
  D: 1,
  F: 0,
};

export const MAX_TERMS = 24;
export const MAX_COURSES = 30;
export const MAX_CREDITS = 30;
export const GPA_PLACES = 2;
export const MAX_GPA = 4;

export interface Course {
  id: string;
  name: string;
  credits: number;
  grade: Grade;
}

export interface Term {
  id: string;
  name: string;
  courses: Course[];
}

export interface GpaData {
  schema: number;
  terms: Term[];
  nextId: number;
}

export const EMPTY_DATA: GpaData = { schema: GPA_SCHEMA, terms: [], nextId: 1 };

export function isGrade(value: string): value is Grade {
  return (GRADES as readonly string[]).includes(value);
}

export function clampCredits(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_CREDITS, Math.round(value * 2) / 2);
}

export function roundGpa(value: number): number {
  return Math.round(value * 10 ** GPA_PLACES) / 10 ** GPA_PLACES;
}

export interface Totals {
  credits: number;
  points: number;
  gpa: number;
}

/**
 * Credits and grade points, added up. Everything else here is built from this,
 * which is why editing an old course recomputes the cumulative figure without
 * any stored running total to get out of step.
 */
export function totalsOf(courses: Course[]): Totals {
  const credits = courses.reduce((sum, course) => sum + clampCredits(course.credits), 0);
  const points = courses.reduce(
    (sum, course) => sum + clampCredits(course.credits) * GRADE_POINTS[course.grade],
    0,
  );

  return { credits, points, gpa: credits === 0 ? 0 : roundGpa(points / credits) };
}

export function termTotals(term: Term): Totals {
  return totalsOf(term.courses);
}

export function cumulativeTotals(data: GpaData): Totals {
  return totalsOf(data.terms.flatMap((term) => term.courses));
}

/** Everything up to and including the given term, for a running GPAX column. */
export function cumulativeThrough(data: GpaData, termId: string): Totals {
  const index = data.terms.findIndex((term) => term.id === termId);
  if (index === -1) return totalsOf([]);

  return totalsOf(data.terms.slice(0, index + 1).flatMap((term) => term.courses));
}

export type TargetState = 'reached' | 'possible' | 'impossible' | 'no-credits';

export interface TargetResult {
  state: TargetState;
  /** The GPA needed next term, when one would do it. */
  needed: number | null;
}

/**
 * What next term has to average to pull the cumulative GPA to a target.
 *
 * (currentPoints + needed × plannedCredits) / (currentCredits + plannedCredits)
 * = target, solved for needed.
 */
export function requiredNextTerm(
  current: Totals,
  plannedCredits: number,
  target: number,
): TargetResult {
  if (current.credits > 0 && current.gpa >= target) {
    return { state: 'reached', needed: null };
  }

  const credits = clampCredits(plannedCredits);
  if (credits <= 0) return { state: 'no-credits', needed: null };

  const needed =
    (target * (current.credits + credits) - current.points) / credits;

  if (needed > MAX_GPA) return { state: 'impossible', needed: roundGpa(needed) };

  return { state: 'possible', needed: roundGpa(Math.max(0, needed)) };
}

export type GpaAction =
  | { type: 'add-term'; name: string }
  | { type: 'rename-term'; termId: string; name: string }
  | { type: 'remove-term'; termId: string }
  | { type: 'add-course'; termId: string }
  | { type: 'edit-course'; termId: string; courseId: string; patch: Partial<Course> }
  | { type: 'remove-course'; termId: string; courseId: string };

function mapTerm(data: GpaData, termId: string, change: (term: Term) => Term): GpaData {
  return {
    ...data,
    terms: data.terms.map((term) => (term.id === termId ? change(term) : term)),
  };
}

export function reduce(data: GpaData, action: GpaAction): GpaData {
  switch (action.type) {
    case 'add-term': {
      const name = action.name.trim();
      if (name.length === 0 || data.terms.length >= MAX_TERMS) return data;

      return {
        ...data,
        nextId: data.nextId + 1,
        terms: [...data.terms, { id: `t${data.nextId}`, name, courses: [] }],
      };
    }

    case 'rename-term':
      return mapTerm(data, action.termId, (term) => ({ ...term, name: action.name }));

    case 'remove-term':
      return { ...data, terms: data.terms.filter((term) => term.id !== action.termId) };

    case 'add-course': {
      const id = `c${data.nextId}`;
      const withCourse = mapTerm(data, action.termId, (term) =>
        term.courses.length >= MAX_COURSES
          ? term
          : {
              ...term,
              courses: [...term.courses, { id, name: '', credits: 3, grade: 'A' }],
            },
      );

      return { ...withCourse, nextId: data.nextId + 1 };
    }

    case 'edit-course':
      return mapTerm(data, action.termId, (term) => ({
        ...term,
        courses: term.courses.map((course) =>
          course.id === action.courseId ? { ...course, ...action.patch } : course,
        ),
      }));

    default:
      return mapTerm(data, action.termId, (term) => ({
        ...term,
        courses: term.courses.filter((course) => course.id !== action.courseId),
      }));
  }
}

export function countStoredItems(data: unknown): number {
  if (!isRecord(data) || !Array.isArray(data.terms)) return 0;

  return data.terms.reduce((sum: number, term: unknown) => {
    if (!isRecord(term) || !Array.isArray(term.courses)) return sum;
    return sum + term.courses.length;
  }, 0);
}

export function migrate(raw: unknown): GpaData {
  const version = storedSchema(raw);
  if (version === null || !isRecord(raw) || version > GPA_SCHEMA) return EMPTY_DATA;

  const terms = asArray(raw.terms)
    .slice(0, MAX_TERMS)
    .filter(isRecord)
    .map((term, index) => ({
      id: asString(term.id, `t${index}`),
      name: asString(term.name, ''),
      courses: asArray(term.courses)
        .slice(0, MAX_COURSES)
        .filter(isRecord)
        .map((course, position) => ({
          id: asString(course.id, `c${position}`),
          name: asString(course.name, ''),
          credits: clampCredits(asNumber(course.credits, 0)),
          grade: isGrade(asString(course.grade)) ? (course.grade as Grade) : 'F',
        })),
    }))
    .filter((term) => term.name.length > 0);

  const highest = terms
    .flatMap((term) => [term.id, ...term.courses.map((course) => course.id)])
    .reduce((top, id) => {
      const numeric = Number(id.replace(/\D/g, ''));
      return Number.isFinite(numeric) ? Math.max(top, numeric) : top;
    }, 0);

  return {
    schema: GPA_SCHEMA,
    terms,
    nextId: Math.max(asNumber(raw.nextId, 1), highest + 1),
  };
}
