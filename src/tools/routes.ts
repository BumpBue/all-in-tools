/**
 * Tools that have their own route segment under src/app/tools/.
 *
 * A dedicated route is what actually splits a tool's code: everything reachable
 * from the single [slug] route lands in that one route's client bundle, so a
 * tool registered there ships to every tool page. Keep this list in step with
 * the directories; routes.test.ts checks it against the filesystem.
 */
export const TOOLS_WITH_OWN_ROUTE: readonly string[] = ['base-converter', 'base64', 'url-encoder', 'hash-generator', 'uuid-generator', 'text-cleaner', 'timestamp-converter', 'date-calculator', 'word-counter', 'aspect-ratio', 'color-converter', 'contrast-checker', 'json-formatter', 'regex-tester', 'jwt-decoder', 'text-diff', 'target-grade', 'thai-lorem-ipsum', 'unit-converter', 'qr-generator', 'markdown-preview', 'css-generator', 'mock-data-generator', 'cron-generator', 'randomizer-wheel', 'image-resizer', 'pomodoro', 'eisenhower-matrix', 'flashcards', 'spaced-repetition', 'habit-tracker', 'gpa-calculator', 'countdown', 'bill-splitter'];

const OWN_ROUTES = new Set(TOOLS_WITH_OWN_ROUTE);

export function hasOwnRoute(slug: string): boolean {
  return OWN_ROUTES.has(slug);
}
