/**
 * How many "items" a tool's stored data represents.
 *
 * The default guesses from the shape, which is right for a flat list or record
 * and wrong for anything nested: a habit tracker holding
 * `{ habits: [...], logs: {...} }` reads as two items rather than the number of
 * habits. A tool with a real data model declares `hasItemCounter` in the
 * registry and adds its counter here.
 */
import { countStoredItems as countDeckItems } from '@/tools/_shared/decks';
import { countStoredItems as countHabitItems } from '@/tools/habit-tracker/logic';
import { countStoredItems as countMatrixItems } from '@/tools/eisenhower-matrix/logic';
import { countStoredItems as countPomodoroItems } from '@/tools/pomodoro/logic';
import { countStoredItems as countWheelItems } from '@/tools/randomizer-wheel/logic';

import { countStoredItems as countGpaItems } from '@/tools/gpa-calculator/logic';

import { countStoredItems as countCountdownItems } from '@/tools/countdown/logic';

import { countStoredItems as countSplitterItems } from '@/tools/bill-splitter/logic';

export type ItemCounter = (data: unknown) => number;

export function countItemsByShape(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (typeof data === 'object' && data !== null) return Object.keys(data).length;
  return data === null || data === undefined ? 0 : 1;
}

export const ITEM_COUNTERS: Record<string, ItemCounter> = {
  'bill-splitter': countSplitterItems,
  'countdown': countCountdownItems,
  'gpa-calculator': countGpaItems,
  'eisenhower-matrix': countMatrixItems,
  flashcards: countDeckItems,
  'habit-tracker': countHabitItems,
  pomodoro: countPomodoroItems,
  'randomizer-wheel': countWheelItems,
};

export function countStoredItems(slug: string, data: unknown): number {
  const counter = ITEM_COUNTERS[slug];
  if (!counter) return countItemsByShape(data);

  try {
    return counter(data);
  } catch {
    // A counter must never be the reason the settings page fails to render.
    return countItemsByShape(data);
  }
}
