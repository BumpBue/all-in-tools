/**
 * How many "items" a tool's stored data represents.
 *
 * The default guesses from the shape, which is right for a flat list or record
 * and wrong for anything nested: a habit tracker holding
 * `{ habits: [...], logs: {...} }` reads as two items rather than the number of
 * habits. A tool with a real data model declares `hasItemCounter` in the
 * registry and adds its counter here.
 */
import { countStoredItems as countWheelItems } from '@/tools/randomizer-wheel/logic';

export type ItemCounter = (data: unknown) => number;

export function countItemsByShape(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (typeof data === 'object' && data !== null) return Object.keys(data).length;
  return data === null || data === undefined ? 0 : 1;
}

export const ITEM_COUNTERS: Record<string, ItemCounter> = {
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
